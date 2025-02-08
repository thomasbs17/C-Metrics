import json
import os
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

from services.ai.raw_training_data import TrainingDataset


class PreProcessing(TrainingDataset):
    new_training: bool
    assets_path: Path = Path("./services/ai/assets")
    pre_processed_df: pd.DataFrame
    raw_training_data: pd.DataFrame

    def __init__(self):
        super().__init__(force_refresh=False)
        os.makedirs(self.assets_path, exist_ok=True)
        self.encoded_pairs_path = f"{self.assets_path}/pair_encode.json"

    def remove_non_used_columns(self):
        self.pre_processed_df.drop(
            columns=["open", "high", "low", "close"], inplace=True
        )

    def to_pct(self, columns: list[str]):
        for col in columns:
            self.pre_processed_df[col] = self.pre_processed_df[col] / 100

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
            self.pre_processed_df[f"close_to_{metric}"] = (
                self.pre_processed_df["close"] / self.pre_processed_df[metric] - 1
            )
        self.pre_processed_df["sma_50_200_ratio"] = (
            self.pre_processed_df["sma_50"] / self.pre_processed_df["sma_200"] - 1
        )
        self.pre_processed_df["volume_to_volume_sma"] = (
            self.pre_processed_df["volume"] / self.pre_processed_df["volume_smma_50"]
            - 1
        )
        self.pre_processed_df.drop(columns=["volume", "volume_smma_50"], inplace=True)
        self.to_pct(columns=["rsi", "greed_and_fear_index", "vix"])
        self.pre_processed_df.drop(columns=distance_to_close_metrics, inplace=True)

    def get_pair_encoding_mapping(self) -> dict:
        with open(self.encoded_pairs_path) as f:
            return json.loads(f.read())

    def encode_pairs(self):
        """
        ✅ Best for tree-based models (XGBoost, LightGBM, CatBoost).
        ✅ Uses historical statistics of each pair rather than arbitrary numbers.
        ✅ Avoids high-dimensionality issues from One-Hot Encoding.

        How It Works
        Each pair is replaced with its average target value (e.g., next-day price movement, returns).
        """
        if self.new_training:
            # can only be done on training data to avoid data leakage (using future data)
            pair_target_means = self.pre_processed_df.groupby("pair")[
                "day_return"
            ].mean()
            with open(f"{self.assets_path}/pair_encode.json", "w") as f:
                f.write(pair_target_means.to_json())
        else:
            pair_target_means = self.get_pair_encoding_mapping()
        self.pre_processed_df["pair_encoded"] = self.pre_processed_df["pair"].map(
            pair_target_means
        )

    def encoded_pair_to_pair(self, encoded_pair: float) -> str:
        pair = None
        mapping = self.get_pair_encoding_mapping()
        for p, encoding in mapping.items():
            if round(encoding, 4) == round(encoded_pair, 4):
                pair = p
        if not pair:
            raise ValueError("Unknown pair")
        return pair

    def standardize_values(self, columns: list[str]):
        full_df = pd.DataFrame()
        for encoded_pair in self.pre_processed_df["pair_encoded"].unique().tolist():
            pair_df = self.pre_processed_df[
                self.pre_processed_df["pair_encoded"] == encoded_pair
            ]
            pair = self.encoded_pair_to_pair(encoded_pair).replace("/", "-")
            standardizer_path = f"{self.assets_path}/{pair}_standard_scaler.gz"
            if self.new_training:
                scaler = StandardScaler()
                scaler.fit(pair_df[columns])
                joblib.dump(scaler, standardizer_path)
            else:
                scaler = joblib.load(standardizer_path)
            pair_df[columns] = scaler.transform(pair_df[columns])
            full_df = pd.concat([full_df, pair_df])
        self.pre_processed_df = full_df.sort_values(by="timestamp").reset_index(
            drop=True
        )

    def countdowns_with_decay(self):
        """
        Nature: Event countdowns with decaying impact

        Exponential decay captures increasing market sensitivity as events approach
        Cyclical encoding preserves repeating nature of scheduled events
        Imminent flags isolate high-impact periods
        """
        # 1. Event proximity decay (non-linear transformation)
        self.pre_processed_df["nfp_decay"] = np.exp(
            -self.pre_processed_df["days_to_next_nfp"] / 7
        )  # 7-day half-life
        self.pre_processed_df["fed_decay"] = np.exp(
            -self.pre_processed_df["days_to_next_fed_decisions"] / 5
        )  # 5-day half-life

        # 2. Cyclical encoding (since events repeat)
        max_nfp = self.pre_processed_df["days_to_next_nfp"].max()
        self.pre_processed_df["nfp_sin"] = np.sin(
            2 * np.pi * self.pre_processed_df.days_to_next_nfp / max_nfp
        )
        self.pre_processed_df["nfp_cos"] = np.cos(
            2 * np.pi * self.pre_processed_df.days_to_next_nfp / max_nfp
        )

        # 3. Binary flag for immediate impact window
        self.pre_processed_df["nfp_imminent"] = (
            self.pre_processed_df.days_to_next_nfp <= 2
        ).astype(int)
        self.pre_processed_df["fed_imminent"] = (
            self.pre_processed_df.days_to_next_fed_decisions <= 1
        ).astype(int)

    def days_of_week(self):
        """
        Nature: Cyclical with potential session-specific patterns

        Fourier encoding preserves cyclical nature
        Special flags capture known market behaviors
        Interaction terms link time to market activity
        """
        # 1. Enhanced cyclical encoding
        self.pre_processed_df["day_sin"] = np.sin(
            2 * np.pi * self.pre_processed_df.day_of_week / 7
        )
        self.pre_processed_df["day_cos"] = np.cos(
            2 * np.pi * self.pre_processed_df.day_of_week / 7
        )
        # 2. Trading session flags
        self.pre_processed_df["weekend_transition"] = (
            (self.pre_processed_df.day_of_week == 4)
            | (self.pre_processed_df.day_of_week == 0)
        ).astype(int)  # Fri/Mon
        self.pre_processed_df["midweek"] = (
            self.pre_processed_df.day_of_week == 2
        ).astype(int)  # Wednesday often pivotal

    def month_of_year(self):
        """
        Nature: Seasonal patterns with institutional effects

        Emphasizes quarterly financial rhythms
        Captures window-dressing effects
        Links to seasonal volatility patterns
        """
        # 1. Quarter-based encoding
        self.pre_processed_df["quarter_sin"] = np.sin(
            2 * np.pi * (self.pre_processed_df.month_of_year - 1) / 12
        )
        self.pre_processed_df["quarter_cos"] = np.cos(
            2 * np.pi * (self.pre_processed_df.month_of_year - 1) / 12
        )

        # 2. Institutional period flags
        self.pre_processed_df["month_end"] = (
            (
                self.pre_processed_df.month_of_year
                != self.pre_processed_df.month_of_year.shift(-1)
            )
            & (
                self.pre_processed_df["pair_encoded"]
                == self.pre_processed_df["pair_encoded"].shift(-1)
            )
        ).astype(int)
        self.pre_processed_df["tax_quarter"] = (
            (self.pre_processed_df.month_of_year % 3) == 0
        ).astype(int)  # Quarterly reporting

        # 3. Volatility interaction
        self.pre_processed_df["month_vol"] = self.pre_processed_df.groupby(
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
        # 1. Non-linear transformation
        self.pre_processed_df["qrt_end_log"] = np.log1p(
            self.pre_processed_df.days_to_quarter_end
        )

        # 2. Pressure zones
        self.pre_processed_df["qrt_pressure"] = np.where(
            self.pre_processed_df.days_to_quarter_end <= 5,
            3,  # High pressure
            np.where(self.pre_processed_df.days_to_quarter_end <= 10, 2, 1),
        )

        # 3. Liquidity interaction
        self.pre_processed_df["qrt_liquidity"] = (
            self.pre_processed_df.days_to_quarter_end
            * self.pre_processed_df.volume_smma_50
        )

    def encode_time_features(self):
        self.countdowns_with_decay()
        self.days_of_week()
        self.month_of_year()
        self.days_to_quarter_end()
        self.pre_processed_df.drop(
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
        self.pre_processed_df["fractal_resistance"] = self.pre_processed_df.apply(
            lambda x: x["close"] / (x["distance_to_ath"] + 1)
            if x["fractal_resistance"] == 999999999
            else x["fractal_resistance"],
            axis=1,
        )

    def encoding(self):
        self.pre_processed_df.replace({False: 0, True: 1}, inplace=True)
        self.pre_processed_df["short_term_trend"].replace(
            {"BEARISH": -1, "NEUTRAL": 0, "BULLISH": 1}, inplace=True
        )
        self.encode_pairs()
        self.encode_time_features()

    def pre_process_data(self, df: pd.DataFrame, new_training: bool) -> pd.DataFrame:
        self.pre_processed_df = df[df["day_return"].notnull()]
        self.new_training = new_training
        self.log.info("Pre-processing data")
        self.handle_non_available_fractals()
        self.encoding()
        self.handle_absolute_values()
        self.standardize_values(
            columns=[
                "distance_to_atl",
                "btc_usd_open_interest",
                "longs_liquidations",
                "shorts_liquidations",
                "nfp",
                "volume_to_volume_sma",
                "qrt_liquidity",
            ],
        )
        self.remove_non_used_columns()
        self.pre_processed_df.replace([np.inf, -np.inf], np.nan, inplace=True)
        self.log.info("Pre-processing ended")
        return self.pre_processed_df
