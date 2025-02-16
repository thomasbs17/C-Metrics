import asyncio
import pickle
from typing import Literal

import pandas as pd
from xgboost import XGBClassifier

from services.ai.train import Train
from utils.helpers import write_file_to_s3, load_from_s3


class BackTest(Train):
    backtest_df: pd.DataFrame
    backtest_x: pd.DataFrame
    backtest_y: pd.Series

    def __init__(
        self, target_type: Literal["take_profit", "stop_loss"], pairs: list[str]
    ):
        super().__init__(target_type=target_type)
        self.pairs = pairs
        # self.reset()

    async def get_backtesting_df(self):
        await self.pre_process_data(pairs=self.pairs)
        self.split()
        self.backtest_df = self.datasets["test"]["df"]
        _, _, _, _, self.backtest_x, self.backtest_y = self.get_datasets()

    def transform_ohlcv(self):
        self.log.info("Transforming OHLCV")
        self.pair_df.insert(
            0, "day_peak", self.pair_df["high"] / self.pair_df["open"] - 1
        )
        self.pair_df.insert(
            0, "day_drawdown", self.pair_df["low"] / self.pair_df["open"] - 1
        )
        self.pair_df.insert(
            0, "day_return", self.pair_df["close"] / self.pair_df["open"] - 1
        )
        self.pair_df["volume"] = self.pair_df["volume"] * self.pair_df["close"]

    def align_in_time(self):
        final_df = pd.DataFrame()
        for pair in self.backtest_df["pair"].unique().tolist():
            pair_df = self.backtest_df[self.backtest_df["pair"] == pair]
            target_col = self.get_training_columns(col_type="target")[0]
            for shift_col in ["prediction", "model_buy", target_col]:
                pair_df[shift_col] = pair_df[shift_col].shift(1).fillna(0)
            final_df = pd.concat([final_df, pair_df])
        self.backtest_df = final_df.sort_values(by=["pair", "calendar_dt"]).reset_index(
            drop=True
        )

    def backtest(
        self,
        raw_df: pd.DataFrame = None,
        model: XGBClassifier = None,
        confidence_threshold: float = 0.5,
    ) -> float:
        self.reset_balance()
        load_from_s3(f"{self.model_name}.pkl")
        model = pickle.load(open(self.model_path, "rb"))
        self.backtest_df.insert(
            0,
            "prediction",
            model.predict_proba(self.backtest_x)[:, 1],
        )
        self.backtest_df.insert(
            0,
            "model_buy",
            self.backtest_df["prediction"] > confidence_threshold,
        )
        self.align_in_time()
        self.backtest_df.drop(self.backtest_df.tail(1).index, inplace=True)
        self.backtest_df.replace({True: 1, False: 0}, inplace=True)
        self.backtest_df.insert(0, "pnl", self.backtest_df.apply(self.get_pnl, axis=1))
        self.backtest_df.insert(
            0, "usd_pnl", self.backtest_df.apply(self.update_balance, axis=1)
        )
        self.backtest_df.insert(
            0, "cumulative_pnl", self.backtest_df["usd_pnl"].cumsum()
        )
        return (self.balance / self.starting_balance) - 1


async def run_backtest(
    test_multiple_confidence_thresholds: bool, pairs: list[str] = None
):
    backtest = BackTest(target_type="take_profit", pairs=pairs)
    await backtest.get_backtesting_df()
    threshold_range = range(1, 101) if test_multiple_confidence_thresholds else [50]
    data = list()
    metadata_content = "\n\nBACKTESTING RESULTS:\n"
    for threshold in threshold_range:
        threshold /= 100
        final_pnl = backtest.backtest(confidence_threshold=threshold)
        data.append(dict(threshold=threshold, final_pnl=final_pnl))
        print(f"Threshold {threshold:,.0%} -> Final P&L is {final_pnl:,.2%}")
        metadata_content += f"- {threshold:,.0%}: {final_pnl:,.2%}\n"
    df = pd.DataFrame(data)
    df.to_csv(f"{backtest.assets_path}/confidence_thresholds_results.csv")
    write_file_to_s3(
        local_path=f"{backtest.assets_path}/{backtest.model_name}_metadata.txt",
        content_to_write=metadata_content,
    )
    print(df.to_string(index=False))


if __name__ == "__main__":
    asyncio.run(run_backtest(test_multiple_confidence_thresholds=False))
