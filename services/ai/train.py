import pickle

import numpy as np
import optuna
import pandas as pd
import xgboost as xgb
from sklearn.metrics import roc_auc_score, classification_report
from sklearn.model_selection import TimeSeriesSplit

from services.ai.pre_process import PreProcessing


class Train(PreProcessing):
    X_train: pd.DataFrame
    y_train: pd.Series
    X_val: pd.DataFrame
    y_val: pd.Series
    X_test: pd.DataFrame
    y_test: pd.Series

    def __init__(self):
        super().__init__()
        self.model_path = f"{self.assets_path}/next_day_price_direction.pkl"
        self.pre_process_data()
        self.split()

    def split(self):
        # Temporal split (70-15-15)
        train_size = int(len(self.training_dataset) * 0.7)
        val_size = int(len(self.training_dataset) * 0.15)

        train_df = self.training_dataset.iloc[:train_size]
        val_df = self.training_dataset.iloc[train_size : train_size + val_size]
        test_df = self.training_dataset.iloc[train_size + val_size :]

        self.X_train = train_df.drop("is_valid_trade", axis=1)
        self.y_train = train_df["is_valid_trade"]
        self.X_val = val_df.drop("is_valid_trade", axis=1)
        self.y_val = val_df["is_valid_trade"]
        self.X_test = test_df.drop("is_valid_trade", axis=1)
        self.y_test = test_df["is_valid_trade"]

    @property
    def model_base_params(self) -> dict:
        # Handle class imbalance
        scale_pos_weight = len(self.y_train[self.y_train == 0]) / len(
            self.y_train[self.y_train == 1]
        )
        base_params = {
            "objective": "binary:logistic",
            "tree_method": "hist",  # Faster for large datasets
            # "tree_method": "gpu_hist",  # Use GPU
            "max_depth": 4,  # Control overfitting
            "subsample": 0.9705016035849733,  # Stochastic training
            "colsample_bytree": 0.7931496885651367,  # Reduce feature noise impact
            "scale_pos_weight": scale_pos_weight,
            "eval_metric": "auc",
            "learning_rate": 0.12598788046480647,
            "n_estimators": 1000,
            "early_stopping_rounds": 50,
            "random_state": 42,
        }
        fine_tuned_params = {
            "gamma": 0.12598788046480647,
            "min_child_weight": 5,
            "reg_alpha": 0.10037763962967822,
            "reg_lambda": 0.723775972043857,
        }
        all_params = {**base_params, **fine_tuned_params}
        return base_params

    def train(self):
        model = xgb.XGBClassifier(**self.model_base_params)
        model.fit(
            self.X_train, self.y_train, eval_set=[(self.X_val, self.y_val)], verbose=20
        )
        pickle.dump(model, open(self.model_path, "wb"))
        y_pred = model.predict_proba(self.X_test)[:, 1]
        roc_auc = roc_auc_score(self.y_test, y_pred)
        self.log.info(f"Test ROC-AUC: {roc_auc:.3f}")
        self.log.info(classification_report(self.y_test, model.predict(self.X_test)))


class Optimization(Train):
    def __init__(self):
        super().__init__()

    def objective(self, trial):
        params = {
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.3),
            "max_depth": trial.suggest_int("max_depth", 3, 9),
            "subsample": trial.suggest_float("subsample", 0.6, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.6, 1.0),
            "gamma": trial.suggest_float("gamma", 0, 5),
            "min_child_weight": trial.suggest_int("min_child_weight", 1, 10),
            "reg_alpha": trial.suggest_float("reg_alpha", 0, 10),
            "reg_lambda": trial.suggest_float("reg_lambda", 0, 10),
            **self.model_base_params,  # Inherits base parameters
        }
        model = xgb.XGBClassifier(**params)
        model.fit(
            self.X_train,
            self.y_train,
            eval_set=[(self.X_val, self.y_val)],
            verbose=False,
        )
        return roc_auc_score(self.y_val, model.predict_proba(self.X_val)[:, 1])

    def hyper_parameter_tuning(self) -> dict:
        self.log.info("Hyperparameters fine-tuning...")
        study = optuna.create_study(direction="maximize")
        study.optimize(self.objective, n_trials=50)
        best_params = {**self.model_base_params, **study.best_params}
        return best_params

    def time_series_cross_validation(self):
        tscv = TimeSeriesSplit(n_splits=5)
        cv_scores = []
        best_params = self.hyper_parameter_tuning()
        self.log.info("Running time-series cross-validation...")
        for fold, (train_idx, val_idx) in enumerate(tscv.split(self.X_train)):
            self.log.info(f"Fold {fold + 1}")
            x_train_fold, x_val_fold = (
                self.X_train.iloc[train_idx],
                self.X_train.iloc[val_idx],
            )
            y_train_fold, y_val_fold = (
                self.y_train.iloc[train_idx],
                self.y_train.iloc[val_idx],
            )
            model = xgb.XGBClassifier(**best_params)
            model.fit(
                x_train_fold,
                y_train_fold,
                eval_set=[(x_val_fold, y_val_fold)],
                verbose=50,
            )

            score = roc_auc_score(y_val_fold, model.predict_proba(x_val_fold)[:, 1])
            cv_scores.append(score)
            self.log.info(f"Fold {fold + 1} AUC: {score:.3f}")

        self.log.info(f"\nMean CV AUC: {np.mean(cv_scores):.3f}")


class BackTest(Optimization):
    starting_balance: int = 1000

    def __init__(self):
        super().__init__()

    def get_pnl(self, row: pd.Series):
        if row["model_buy"]:
            if row["next_day_drawdown"] < self.stop_loss:
                return self.stop_loss
            if row["next_day_peak"] > self.take_profit:
                return self.take_profit
            return row["next_day_return"]
        return 0

    def backtest(self):
        model = pickle.load(open(self.model_path, "rb"))
        self.X_test.insert(0, "prediction", model.predict_proba(self.X_test)[:, 1])
        self.X_test.insert(0, "model_buy", self.X_test["prediction"] > 0.5)
        self.X_test.insert(0, "is_valid_trade", self.y_test)
        cols = ["day_return", "day_drawdown", "day_peak"]
        for col in cols:
            self.X_test[f"next_{col}"] = self.X_test[col].shift(-1)
        self.X_test.insert(
            0, "pnl", self.X_test.apply(lambda x: self.get_pnl(x), axis=1)
        )
        self.X_test.drop(columns=[f"next_{col}" for col in cols], inplace=True)
        self.X_test.insert(
            0,
            "usd_pnl",
            self.starting_balance * (self.X_test["pnl"] + 1) - self.starting_balance,
        )
        self.X_test.insert(0, "cumulative_pnl", self.X_test["usd_pnl"].cumsum())


if __name__ == "__main__":
    backtest = BackTest()
    backtest.train()
    backtest.time_series_cross_validation()
    backtest.backtest()
    final_pnl = backtest.X_test["cumulative_pnl"].iloc[-1] / backtest.starting_balance
    print(f"Final P&L is {final_pnl:,.2%}")
