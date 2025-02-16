import json
import os
from pathlib import Path
from typing import Literal

import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

from services.ai.raw_training_data import TrainingDataset


class PreProcessing(TrainingDataset):
    assets_path: Path = Path("./services/ai/assets")
    pre_processed_df: pd.DataFrame

    def __init__(
        self,
        is_training: bool,
        target_type: Literal["take_profit", "stop_loss"],
    ):
        super().__init__(force_refresh=False, target_type=target_type)
        self.is_training = is_training
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
        ]
        for metric in distance_to_close_metrics:
            self.pre_processed_df[f"close_to_{metric}"] = (
                self.pre_processed_df["close"] / self.pre_processed_df[metric] - 1
            )
        self.pre_processed_df["sma_50_200_ratio"] = (
            self.pre_processed_df["sma_50"] / self.pre_processed_df["sma_200"] - 1
        )
        self.pre_processed_df["volume_to_volume_sma"] = (
            self.pre_processed_df["usd_volume"] / self.pre_processed_df["volume_sma_50"]
            - 1
        )
        self.pre_processed_df.drop(
            columns=["usd_volume", "volume_sma_50"], inplace=True
        )
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
        if self.is_training:
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

    def standardize_with_cache(
        self, pair_df: pd.DataFrame, cols: list[str], standardizer_name: str
    ) -> pd.DataFrame:
        standardizer_path = f"{self.assets_path}/{standardizer_name}.gz"
        if self.is_training:
            scaler = StandardScaler()
            scaler.fit(pair_df[cols])
            joblib.dump(scaler, standardizer_path)
        else:
            scaler = joblib.load(standardizer_path)
        pair_df[cols] = scaler.transform(pair_df[cols])
        return pair_df

    def standardize_values(self):
        full_df = pd.DataFrame()
        cols = [
            "distance_to_atl",
            "distance_to_ath",
            "btc_usd_open_interest",
            "qrt_liquidity",
        ]
        nfp_cols = [
            "nfp_actual",
            "nfp_forecast",
            "nfp_previous",
        ]
        liquidation_cols = ["longs_liquidations", "shorts_liquidations"]
        for encoded_pair in self.pre_processed_df["pair_encoded"].unique().tolist():
            pair_df = self.pre_processed_df[
                self.pre_processed_df["pair_encoded"] == encoded_pair
            ]
            pair = self.encoded_pair_to_pair(encoded_pair).replace("/", "-")
            for col in cols:
                pair_df = self.standardize_with_cache(
                    pair_df, [col], f"{pair}_{col}_standard_scaler"
                )
            pair_df = self.standardize_with_cache(
                pair_df, nfp_cols, f"{pair}_nfp_standard_scaler"
            )
            pair_df = self.standardize_with_cache(
                pair_df, liquidation_cols, f"{pair}_liquidation_standard_scaler"
            )
            full_df = pd.concat([full_df, pair_df])
        self.pre_processed_df = full_df.sort_values(by="calendar_dt").reset_index(
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
            * self.pre_processed_df.volume_sma_50
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

    def encoding(self):
        self.pre_processed_df.replace({False: 0, True: 1}, inplace=True)
        self.encode_pairs()
        self.encode_time_features()

    async def pre_process_data(self, pairs: list[str]) -> pd.DataFrame:
        self.raw_data = self.load_training_dataset(pairs=pairs)
        self.pre_processed_df = await self.add_indicators()
        self.log.info("Pre-processing data")
        self.encoding()
        self.handle_absolute_values()
        self.standardize_values()
        self.remove_non_used_columns()
        # self.pre_processed_df.replace([np.inf, -np.inf], np.nan, inplace=True)
        self.log.info("Pre-processing ended")
        if pairs:
            self.pre_processed_df = self.pre_processed_df[
                self.pre_processed_df["pair"].isin(pairs)
            ]
        return self.pre_processed_df
