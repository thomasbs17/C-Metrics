import asyncio
import json
import pickle
from datetime import datetime as dt
from pathlib import Path
from typing import Literal

import numpy as np
import optuna
import pandas as pd
import xgboost as xgb
from sklearn.metrics import roc_auc_score, classification_report
from sklearn.model_selection import TimeSeriesSplit

from services.ai.pre_process import PreProcessing


class TrainingOptimization(PreProcessing):
    model_base_params: dict

    datasets: dict

    def __init__(
        self,
        target_type: Literal["take_profit", "stop_loss"],
    ):
        super().__init__(is_training=True, target_type=target_type)
        self.best_params_path = f"{self.assets_path}/best_hyperparameters.json"

    def backtest(self, confidence_threshold: float):
        pass

    def get_training_columns(
        self, col_type: Literal["features", "target"]
    ) -> list[str]:
        target_col = f"hit_{self.target_type}"
        if col_type == "target":
            return [target_col]
        df = self.pre_processed_df.copy(deep=True)
        cols_to_remove = ["pair", "calendar_dt"]
        df.drop(columns=cols_to_remove, inplace=True)
        cols = df.columns.tolist()
        return [col for col in cols if col != target_col]

    def get_datasets(
        self,
    ) -> tuple[
        pd.DataFrame,
        pd.DataFrame,
        pd.DataFrame,
        pd.DataFrame,
        pd.DataFrame,
        pd.DataFrame,
    ]:
        target_col = self.get_training_columns("target")[0]
        features_cols = self.get_training_columns("features")
        train_x = self.datasets["train"]["df"][features_cols]
        train_y = self.datasets["train"]["df"][target_col]
        test_x = self.datasets["test"]["df"][features_cols]
        test_y = self.datasets["test"]["df"][target_col]
        val_x = self.datasets["val"]["df"][features_cols]
        val_y = self.datasets["val"]["df"][target_col]
        return train_x, train_y, val_x, val_y, test_x, test_y

    def objective(self, trial):
        params = {
            # Core model parameters
            "objective": "binary:logistic",
            "booster": trial.suggest_categorical("booster", ["gbtree"]),
            "n_jobs": -1,  # Typically fixed to use all cores
            # Tree architecture parameters
            "max_depth": trial.suggest_int("max_depth", 3, 12),
            "max_leaves": trial.suggest_int("max_leaves", 16, 128),
            "grow_policy": trial.suggest_categorical(
                "grow_policy", ["depthwise", "lossguide"]
            ),
            "max_bin": trial.suggest_int("max_bin", 100, 1024),
            # Regularization parameters
            "gamma": trial.suggest_float("gamma", 0, 10),
            "reg_alpha": trial.suggest_float("reg_alpha", 1e-3, 100, log=True),
            "reg_lambda": trial.suggest_float("reg_lambda", 1e-3, 100, log=True),
            "min_child_weight": trial.suggest_int("min_child_weight", 1, 20),
            # Stochastic training
            "subsample": trial.suggest_float("subsample", 0.5, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.5, 1.0),
            "colsample_bylevel": trial.suggest_float("colsample_bylevel", 0.5, 1.0),
            # Learning parameters
            "learning_rate": trial.suggest_float("learning_rate", 0.005, 0.2, log=True),
            "n_estimators": trial.suggest_int("n_estimators", 500, 3000),
            # Imbalance handling
            "max_delta_step": trial.suggest_int("max_delta_step", 0, 10),
            # Early stopping (if you use early stopping, this is just a suggestion to the training loop)
            "early_stopping_rounds": trial.suggest_int(
                "early_stopping_rounds", 10, 100
            ),
            # Reproducibility and evaluation
            "random_state": 42,
            "eval_metric": trial.suggest_categorical("eval_metric", ["auc", "logloss"]),
        }
        model = xgb.XGBClassifier(**params)
        train_x, train_y, val_x, val_y, _, _ = self.get_datasets()
        model.fit(
            train_x,
            train_y,
            eval_set=[(val_x, val_y)],
            verbose=False,
        )
        return roc_auc_score(
            val_y,
            model.predict_proba(val_x)[:, 1],
        )

    def hyper_parameter_tuning(self, n_trials: int = 100) -> dict:
        self.log.info("Hyperparameters fine-tuning...")
        study = optuna.create_study(direction="maximize")
        study.optimize(self.objective, n_trials=n_trials)
        best_params = {**self.model_base_params, **study.best_params}
        with open(self.best_params_path, "w") as f:
            f.write(json.dumps(best_params))
        self.log.info(f"Best parameters:\n{best_params}")
        return best_params

    def time_series_cross_validation(self, best_params: dict):
        tscv = TimeSeriesSplit(n_splits=5)
        cv_scores = []
        self.log.info("Running time-series cross-validation...")
        train_x, train_y, val_x, val_y, _, _ = self.get_datasets()

        for fold, (train_idx, val_idx) in enumerate(tscv.split(train_x)):
            self.log.info(f"Fold {fold + 1}")
            x_train_fold, x_val_fold = (
                train_x.iloc[train_idx],
                val_x.iloc[val_idx],
            )
            y_train_fold, y_val_fold = (
                train_y.iloc[train_idx],
                val_y.iloc[val_idx],
            )
            model = xgb.XGBClassifier(**best_params)
            model.fit(
                x_train_fold,
                y_train_fold,
                eval_set=[(x_val_fold, y_val_fold)],
                verbose=50,
            )

            score = roc_auc_score(
                y_val_fold,
                model.predict_proba(x_val_fold)[:, 1],
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

    def __init__(
        self,
        target_type: Literal["take_profit", "stop_loss"],
    ):
        super().__init__(target_type=target_type)
        self.model_path = f"{self.assets_path}/{self.model_name}.pkl"

    def split(self):
        # Temporal split (80-10-10)
        all_dates = self.pre_processed_df["calendar_dt"].unique().tolist()
        train_size = int(len(all_dates) * self.train_size)
        val_size = int(len(all_dates) * self.validate_size)
        datasets = {
            "train": {"dates": all_dates[:train_size]},
            "val": {"dates": all_dates[train_size : train_size + val_size]},
            "test": {"dates": all_dates[train_size + val_size :]},
        }
        for dataset, details in datasets.items():
            df = self.pre_processed_df[
                self.pre_processed_df["calendar_dt"].isin(details["dates"])
            ]
            datasets[dataset]["df"] = df
        self.datasets = datasets

    @property
    def model_base_params(self) -> dict:
        # Handle class imbalance
        _, train_y, _, _, _, _ = self.get_datasets()
        scale_pos_weight = len(train_y[train_y == 0]) / len(train_y[train_y == 1])
        best_params = {}
        if Path(self.best_params_path).is_file():
            with open(self.best_params_path) as f:
                best_params = json.loads(f.read())
        # todo: implement custom objective to maximize pnl and heavy penalization for false positives
        base_params = {
            # Core Parameters
            "objective": "binary:logistic",
            "tree_method": "hist",  # Switch to "gpu_hist" if available
            "booster": "gbtree",
            "n_jobs": -1,  # Utilize all CPU cores
            # Tree Architecture
            "max_depth": 6,  # Increased for financial pattern capture
            "max_leaves": 64,  # Better for financial data patterns
            "grow_policy": "lossguide",  # Better for high-dimensional data
            "max_bin": 512,  # Increased resolution for financial features
            # Regularization
            "gamma": 0.5,  # Minimum loss reduction for splits
            "reg_alpha": 1.0,  # L1 regularization
            "reg_lambda": 5.0,  # Stronger L2 for noisy financial data
            "min_child_weight": 10,  # Conservative splits
            # Stochastic Training
            "subsample": 0.8,  # Slightly reduced for stability
            "colsample_bytree": 0.7,  # More conservative feature sampling
            "colsample_bylevel": 0.7,
            # Learning Rate
            "learning_rate": 0.05,  # Lower for better generalization
            "n_estimators": 2000,  # Compensate for lower learning rate
            # Imbalance Handling
            "scale_pos_weight": scale_pos_weight,
            "max_delta_step": 2,  # Helps with class imbalance
            # Early Stopping
            "early_stopping_rounds": 50,
            # Reproducibility
            "random_state": 42,
            # Evaluation
            "eval_metric": ["auc", "logloss"],  # Monitor multiple metrics
        }
        return {**base_params, **best_params}

    def save_model_and_metadata(
        self,
        model: xgb.XGBClassifier,
        roc_auc: float,
        report: str,
    ):
        pickle.dump(model, open(self.model_path, "wb"))
        x, _, _, _, _, _ = self.get_datasets()
        pairs = (
            x["pair_encoded"]
            .apply(lambda x: self.encoded_pair_to_pair(x))
            .unique()
            .tolist()
        )
        metadata = dict(
            trained_on=dt.now().isoformat(),
            dataset_size=len(x),
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

    async def train(self, with_optimization: bool, pairs: list[str]):
        await self.pre_process_data(pairs=pairs)
        self.split()
        if with_optimization:
            best_params = self.hyper_parameter_tuning(n_trials=10)
            # self.time_series_cross_validation(best_params)
        model = xgb.XGBClassifier(**self.model_base_params)
        train_x, train_y, val_x, val_y, test_x, test_y = self.get_datasets()
        model.fit(
            train_x,
            train_y,
            eval_set=[(val_x, val_y)],
            verbose=20,
        )
        roc_auc = roc_auc_score(
            test_y,
            model.predict_proba(test_x)[:, 1],
        )
        report = classification_report(test_y, model.predict(test_x))
        self.save_model_and_metadata(model=model, roc_auc=roc_auc, report=report)
        self.log.info(f"Test ROC-AUC: {roc_auc:.3f}")
        print(report)


if __name__ == "__main__":
    training = Train(target_type="take_profit")
    asyncio.run(training.train(with_optimization=True, pairs=["BTC/USD"]))
