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

    def __init__(self):
        super().__init__()
        self.best_params_path = f"{self.assets_path}/best_hyperparameters.json"

    def backtest(self, confidence_threshold: float):
        pass

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
        model.fit(
            self.datasets["train"]["x"],
            self.datasets["train"]["y"],
            eval_set=[(self.datasets["val"]["x"], self.datasets["val"]["y"])],
            verbose=False,
        )
        return roc_auc_score(
            self.datasets["val"]["y"],
            model.predict_proba(self.datasets["val"]["x"])[:, 1],
        )

    def hyper_parameter_tuning(self) -> dict:
        self.log.info("Hyperparameters fine-tuning...")
        study = optuna.create_study(direction="maximize")
        study.optimize(self.objective, n_trials=100)
        best_params = {**self.model_base_params, **study.best_params}
        with open(self.best_params_path, "w") as f:
            f.write(json.dumps(best_params))
        self.log.info(f"Best parameters:\n{best_params}")
        return best_params

    def time_series_cross_validation(self):
        tscv = TimeSeriesSplit(n_splits=5)
        cv_scores = []
        self.log.info("Running time-series cross-validation...")
        y_train = self.datasets["train"]["y"]
        best_params = self.hyper_parameter_tuning()
        for fold, (train_idx, val_idx) in enumerate(
            tscv.split(self.datasets["train"]["x"])
        ):
            self.log.info(f"Fold {fold + 1}")
            x_train_fold, x_val_fold = (
                self.datasets["train"]["x"].iloc[train_idx],
                self.datasets["train"]["x"].iloc[val_idx],
            )
            y_train_fold, y_val_fold = (
                y_train.iloc[train_idx],
                y_train.iloc[val_idx],
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

    def __init__(self):
        super().__init__()
        self.model_path = f"{self.assets_path}/{self.model_name}.pkl"

    def split(self):
        # Temporal split (80-10-10)
        self.raw_training_data["timestamp"] = pd.to_datetime(
            self.raw_training_data["timestamp"]
        ).dt.date
        all_dates = self.raw_training_data["timestamp"].unique().tolist()
        train_size = int(len(all_dates) * self.train_size)
        val_size = int(len(all_dates) * self.validate_size)
        datasets = {
            "train": {"dates": all_dates[:train_size]},
            "val": {"dates": all_dates[train_size : train_size + val_size]},
            "test": {"dates": all_dates[train_size + val_size :]},
        }
        for dataset, details in datasets.items():
            df = self.raw_training_data[
                self.raw_training_data["timestamp"].isin(details["dates"])
            ]
            new_training = True if dataset == "train" else False
            # datasets[dataset]["detailed_x"] = self.pre_process_data(
            #     df=df.drop(columns=["is_valid_trade"]),
            #     new_training=new_training,
            # )
            datasets[dataset]["x"] = (
                datasets[dataset]["detailed_x"]
                .copy(deep=True)
                .drop(columns=["pair", "timestamp"])
            )
            y = df[["timestamp", "pair", "is_valid_trade"]]
            y = datasets[dataset]["detailed_x"].merge(
                right=y, how="left", on=["timestamp", "pair"]
            )
            datasets[dataset]["y"] = y["is_valid_trade"]
        self.datasets = datasets

    @property
    def model_base_params(self) -> dict:
        # Handle class imbalance
        y = self.datasets["train"]["y"]
        scale_pos_weight = len(y[y == 0]) / len(y[y == 1])
        best_params = {}
        if Path(self.best_params_path).is_file():
            with open(self.best_params_path) as f:
                best_params = json.loads(f.read())
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
        pairs = (
            self.datasets["train"]["x"]["pair_encoded"]
            .apply(lambda x: self.encoded_pair_to_pair(x))
            .unique()
            .tolist()
        )
        metadata = dict(
            trained_on=dt.now().isoformat(),
            dataset_size=len(self.datasets["train"]["x"]),
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

    async def train(
        self,
        with_optimization: bool,
        pairs: list[str],
        target_type: Literal["take_profit", "stop_loss"],
    ):
        await self.pre_process_data(pairs=pairs, target_type=target_type)
        self.split()
        if with_optimization:
            self.time_series_cross_validation()
        model = xgb.XGBClassifier(**self.model_base_params)
        model.fit(
            self.datasets["train"]["x"],
            self.datasets["train"]["y"],
            eval_set=[(self.datasets["val"]["x"], self.datasets["val"]["y"])],
            verbose=20,
        )
        roc_auc = roc_auc_score(
            self.datasets["test"]["y"],
            model.predict_proba(self.datasets["test"]["x"])[:, 1],
        )
        report = classification_report(
            self.datasets["test"]["y"], model.predict(self.datasets["test"]["x"])
        )
        self.save_model_and_metadata(model=model, roc_auc=roc_auc, report=report)
        self.log.info(f"Test ROC-AUC: {roc_auc:.3f}")
        print(report)


if __name__ == "__main__":
    training = Train()
    asyncio.run(
        training.train(
            with_optimization=True, target_type="take_profit", pairs=["BTC/USD"]
        )
    )
