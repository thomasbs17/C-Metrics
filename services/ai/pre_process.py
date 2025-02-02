import os
from pathlib import Path

import joblib
import numpy as np
from sklearn.preprocessing import StandardScaler

from services.ai.raw_training_data import TrainingDataset


class PreProcessing(TrainingDataset):
    assets_path: Path = Path("./services/ai/assets")

    def __init__(self):
        super().__init__(force_refresh=False)
        os.makedirs(self.assets_path, exist_ok=True)
        self.raw_data = self.load_training_dataset(pair="XRP/USD")
        self.training_dataset = self.raw_data.copy(deep=True)

    def remove_non_used_columns(self):
        self.training_dataset.drop(
            columns=["open", "high", "low", "close", "timestamp"], inplace=True
        )

    def to_pct(self, columns: list[str]):
        for col in columns:
            self.training_dataset[col] = self.training_dataset[col] / 100

    def handle_absolute_values(self):
        distance_to_close_metrics = [
            "sma_50",
            "sma_200",
            "ema_100",
            "fractal_support",
            "fractal_resistance",
            "bollinger_upper",
            "bollinger_middle",
            "bollinger_lower",
            "poc",
            "poc_resistance",
            "poc_support",
        ]
        for metric in distance_to_close_metrics:
            self.training_dataset[f"close_to_{metric}"] = (
                self.training_dataset["close"] / self.training_dataset[metric] - 1
            )
        self.training_dataset["sma_50_200_ratio"] = (
            self.training_dataset["sma_50"] / self.training_dataset["sma_200"] - 1
        )
        self.training_dataset["volume_to_volume_sma"] = (
            self.training_dataset["volume"] / self.training_dataset["volume_smma_50"]
            - 1
        )
        self.training_dataset.drop(columns=["volume", "volume_smma_50"], inplace=True)
        self.to_pct(columns=["rsi", "greed_and_fear_index", "vix"])
        self.training_dataset.drop(columns=distance_to_close_metrics, inplace=True)

    def encode_pairs(self):
        """
        ✅ Best for tree-based models (XGBoost, LightGBM, CatBoost).
        ✅ Uses historical statistics of each pair rather than arbitrary numbers.
        ✅ Avoids high-dimensionality issues from One-Hot Encoding.

        How It Works
        Each pair is replaced with its average target value (e.g., next-day price movement, returns).
        """
        # TODO: only on training data!!!!!!!!!
        pair_target_means = self.training_dataset.groupby("pair")[
            "is_valid_trade"
        ].mean()
        with open(f"{self.assets_path}/pair_encode.json", "w") as f:
            f.write(pair_target_means.to_json())
        self.training_dataset["pair_encoded"] = self.training_dataset["pair"].map(
            pair_target_means
        )
        self.training_dataset.drop(columns=["pair"], inplace=True)

    def encode_categorical_data(self):
        self.training_dataset.replace({False: 0, True: 1}, inplace=True)
        self.training_dataset["short_term_trend"].replace(
            {"BEARISH": -1, "NEUTRAL": 0, "BULLISH": 1}, inplace=True
        )
        self.encode_pairs()

    def standardize_values(self, columns: list[str]):
        scaler = StandardScaler()
        scaler.fit(self.training_dataset[columns])
        joblib.dump(scaler, f"{self.assets_path}/standard_scaler.gz")
        self.training_dataset[columns] = scaler.transform(
            self.training_dataset[columns]
        )

    def countdowns_with_decay(self):
        """
        Nature: Event countdowns with decaying impact

        Exponential decay captures increasing market sensitivity as events approach
        Cyclical encoding preserves repeating nature of scheduled events
        Imminent flags isolate high-impact periods
        """
        # 1. Event proximity decay (non-linear transformation)
        self.training_dataset["nfp_decay"] = np.exp(
            -self.training_dataset["days_to_next_nfp"] / 7
        )  # 7-day half-life
        self.training_dataset["fed_decay"] = np.exp(
            -self.training_dataset["days_to_next_fed_decisions"] / 5
        )  # 5-day half-life

        # 2. Cyclical encoding (since events repeat)
        max_nfp = self.training_dataset["days_to_next_nfp"].max()
        self.training_dataset["nfp_sin"] = np.sin(
            2 * np.pi * self.training_dataset.days_to_next_nfp / max_nfp
        )
        self.training_dataset["nfp_cos"] = np.cos(
            2 * np.pi * self.training_dataset.days_to_next_nfp / max_nfp
        )

        # 3. Binary flag for immediate impact window
        self.training_dataset["nfp_imminent"] = (
            self.training_dataset.days_to_next_nfp <= 2
        ).astype(int)
        self.training_dataset["fed_imminent"] = (
            self.training_dataset.days_to_next_fed_decisions <= 1
        ).astype(int)

    def days_of_week(self):
        """
        Nature: Cyclical with potential session-specific patterns

        Fourier encoding preserves cyclical nature
        Special flags capture known market behaviors
        Interaction terms link time to market activity
        """
        # 1. Enhanced cyclical encoding
        self.training_dataset["day_sin"] = np.sin(
            2 * np.pi * self.training_dataset.day_of_week / 7
        )
        self.training_dataset["day_cos"] = np.cos(
            2 * np.pi * self.training_dataset.day_of_week / 7
        )
        # 2. Trading session flags
        self.training_dataset["weekend_transition"] = (
            (self.training_dataset.day_of_week == 4)
            | (self.training_dataset.day_of_week == 0)
        ).astype(int)  # Fri/Mon
        self.training_dataset["midweek"] = (
            self.training_dataset.day_of_week == 2
        ).astype(int)  # Wednesday often pivotal

    def month_of_year(self):
        """
        Nature: Seasonal patterns with institutional effects

        Emphasizes quarterly financial rhythms
        Captures window-dressing effects
        Links to seasonal volatility patterns
        """
        # 1. Quarter-based encoding
        self.training_dataset["quarter_sin"] = np.sin(
            2 * np.pi * (self.training_dataset.month_of_year - 1) / 12
        )
        self.training_dataset["quarter_cos"] = np.cos(
            2 * np.pi * (self.training_dataset.month_of_year - 1) / 12
        )

        # 2. Institutional period flags
        self.training_dataset["month_end"] = (
            self.training_dataset.month_of_year
            != self.training_dataset.month_of_year.shift(-1)
        ).astype(int)
        self.training_dataset["tax_quarter"] = (
            (self.training_dataset.month_of_year % 3) == 0
        ).astype(int)  # Quarterly reporting

        # 3. Volatility interaction
        self.training_dataset["month_vol"] = self.training_dataset.groupby(
            "month_of_year"
        )["historical_volatility"].transform("mean")

    def days_to_quarter_end(self):
        """
        Nature: Institutional portfolio management driver

        Log transform handles right-skewed distribution
        Pressure zones capture institutional rebalancing
        Links time pressure to liquidity conditions
        """
        # 1. Non-linear transformation
        self.training_dataset["qrt_end_log"] = np.log1p(
            self.training_dataset.days_to_quarter_end
        )

        # 2. Pressure zones
        self.training_dataset["qrt_pressure"] = np.where(
            self.training_dataset.days_to_quarter_end <= 5,
            3,  # High pressure
            np.where(self.training_dataset.days_to_quarter_end <= 10, 2, 1),
        )

        # 3. Liquidity interaction
        self.training_dataset["qrt_liquidity"] = (
            self.training_dataset.days_to_quarter_end
            * self.training_dataset.volume_smma_50
        )

    def encode_time_features(self):
        self.countdowns_with_decay()
        self.days_of_week()
        self.month_of_year()
        self.days_to_quarter_end()
        self.training_dataset.drop(
            columns=[
                "days_to_next_nfp",
                "days_to_next_fed_decisions",
                "day_of_week",
                "month_of_year",
                "days_to_quarter_end",
            ],
            inplace=True,
        )

    def handle_non_available_fractals(self):
        self.training_dataset["fractal_resistance"] = self.training_dataset.apply(
            lambda x: x["close"] / (x["distance_to_ath"] + 1)
            if x["fractal_resistance"] == 999999999
            else x["fractal_resistance"],
            axis=1,
        )

    def pre_process_data(self):
        self.log.info("Pre-processing data")
        self.add_valid_trades(df=self.training_dataset)  # todo: redo for each pair
        self.handle_non_available_fractals()
        self.encode_time_features()
        self.encode_categorical_data()
        self.handle_absolute_values()
        self.remove_non_used_columns()
        self.training_dataset.replace([np.inf, -np.inf], np.nan, inplace=True)
        self.standardize_values(
            columns=[
                "distance_to_atl",
                "btc_usd_open_interest",
                "longs_liquidations",
                "shorts_liquidations",
                "nfp",
                "volume_to_volume_sma",
                "qrt_liquidity",
            ]
        )
        self.log.info("Pre-processing ended")


if __name__ == "__main__":
    process = PreProcessing()
    process.pre_process_data()
