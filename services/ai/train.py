import json
import pickle
from datetime import datetime as dt
from pathlib import Path

import numpy as np
import optuna
import pandas as pd
import xgboost as xgb
from sklearn.metrics import roc_auc_score, classification_report
from sklearn.model_selection import TimeSeriesSplit

from services.ai.pre_process import PreProcessing


class TrainingOptimization(PreProcessing):
    model_base_params: dict

    def __init__(self):
        super().__init__()
        self.best_params_path = f"{self.assets_path}/best_hyperparameters.json"

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
            self.X_train.drop(columns=["timestamp"]),
            self.y_train,
            eval_set=[(self.X_val.drop(columns=["timestamp"]), self.y_val)],
            verbose=False,
        )
        return roc_auc_score(
            self.y_val,
            model.predict_proba(self.X_val.drop(columns=["timestamp"]))[:, 1],
        )

    def hyper_parameter_tuning(self) -> dict:
        self.log.info("Hyperparameters fine-tuning...")
        study = optuna.create_study(direction="maximize")
        study.optimize(self.objective, n_trials=50)
        best_params = {**self.model_base_params, **study.best_params}
        with open(self.best_params_path, "w") as f:
            f.write(json.dumps(best_params))
        self.log.info(f"Best parameters:\n{best_params}")
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
                x_train_fold.drop(columns=["timestamp"]),
                y_train_fold,
                eval_set=[(x_val_fold.drop(columns=["timestamp"]), y_val_fold)],
                verbose=50,
            )

            score = roc_auc_score(
                y_val_fold,
                model.predict_proba(x_val_fold.drop(columns=["timestamp"]))[:, 1],
            )
            cv_scores.append(score)
            self.log.info(f"Fold {fold + 1} AUC: {score:.3f}")

        self.log.info(f"\nMean CV AUC: {np.mean(cv_scores):.3f}")


class Train(TrainingOptimization):
    raw_training_data: pd.DataFrame
    model_name: str = "next_day_price_direction"

    train_size: float = 0.8
    validate_size: float = 0.1
    test_size: float = 0.1

    def __init__(self, new_training: bool, pairs: list[str] = None):
        super().__init__()
        self.new_training = new_training
        self.model_path = f"{self.assets_path}/{self.model_name}.pkl"
        self.raw_training_data = self.load_training_dataset(pairs=pairs)
        self.fix_target()
        self.split()

    def split(self):
        # Temporal split (80-10-10)
        self.raw_training_data["timestamp"] = pd.to_datetime(
            self.raw_training_data["timestamp"]
        ).dt.date
        all_dates = self.raw_training_data["timestamp"].unique().tolist()
        train_size = int(len(all_dates) * self.train_size)
        val_size = int(len(all_dates) * self.validate_size)
        train_dates = all_dates[:train_size]
        val_dates = all_dates[train_size : train_size + val_size]
        test_dates = all_dates[train_size + val_size :]

        train_df = self.raw_training_data[
            self.raw_training_data["timestamp"].isin(train_dates)
        ]
        val_df = self.raw_training_data[
            self.raw_training_data["timestamp"].isin(val_dates)
        ]
        test_df = self.raw_training_data[
            self.raw_training_data["timestamp"].isin(test_dates)
        ]
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
        if Path(self.best_params_path).is_file():
            with open(self.best_params_path) as f:
                return json.loads(f.read())
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
        return base_params

    def save_model_and_metadata(
        self,
        model: xgb.XGBClassifier,
        roc_auc: float,
        report: str,
    ):
        pickle.dump(model, open(self.model_path, "wb"))
        pairs = (
            self.X_train["pair_encoded"]
            .apply(lambda x: self.encoded_pair_to_pair(x))
            .unique()
            .tolist()
        )
        metadata = dict(
            trained_on=dt.now().isoformat(),
            dataset_size=len(self.X_train),
            included_pairs=pairs,
            train_size=self.train_size,
            validate_size=self.validate_size,
            test_size=self.test_size,
            roc_auc=roc_auc,
        )
        content = ""
        for k, v in metadata.items():
            content += f"- {k}: {v}\n"
        content += f"\n\nTRAINING RESULTS:\n\n{report}"
        with open(f"{self.assets_path}/{self.model_name}_metadata.txt", "w") as f:
            f.write(content)

    def train(self, with_optimization: bool):
        self.X_train = self.pre_process_data(df=self.X_train, new_training=True)
        self.X_val = self.pre_process_data(df=self.X_val, new_training=False)
        self.X_test = self.pre_process_data(df=self.X_test, new_training=False)

        model = xgb.XGBClassifier(**self.model_base_params)
        model.fit(
            self.X_train.drop(columns=["timestamp"]),
            self.y_train,
            eval_set=[(self.X_val.drop(columns=["timestamp"]), self.y_val)],
            verbose=20,
        )
        if with_optimization:
            self.time_series_cross_validation()
        y_pred = model.predict_proba(self.X_test.drop(columns=["timestamp"]))[:, 1]
        roc_auc = roc_auc_score(self.y_test, y_pred)
        report = classification_report(
            self.y_test, model.predict(self.X_test.drop(columns=["timestamp"]))
        )
        self.save_model_and_metadata(
            model=model, roc_auc=roc_auc, report=classification_report
        )
        self.log.info(f"Test ROC-AUC: {roc_auc:.3f}")
        print(report)
