import asyncio
import pickle

import pandas as pd

from services.ai.indicators import Indicators
from services.ai.raw_training_data import TrainingDataset


class BackTest(Indicators):
    starting_balance: int = 1000
    balance: int

    def __init__(self, backtest_df: pd.DataFrame):
        super().__init__()
        self.backtest_df = backtest_df
        # self.reset()

    def reset(self):
        self.balance = self.starting_balance

    def get_pnl(self, row: pd.Series):
        row.fillna(False, inplace=True)
        if row["model_buy"]:
            if row["day_drawdown"] < self.stop_loss:
                return self.stop_loss
            if row["day_peak"] > self.take_profit:
                return self.take_profit
            return row["day_return"]
        return 0

    def update_balance(self, row: pd.Series, weight: float = 1) -> float:
        trade_usd_pnl = 0
        if row["model_buy"]:
            investable_amount = self.balance * weight
            trade_usd_pnl = (investable_amount * (row["pnl"] + 1)) - investable_amount
            self.balance += trade_usd_pnl
        return trade_usd_pnl

    def align_in_time(self):
        final_df = pd.DataFrame()
        for pair in self.backtest_df["pair"].unique().tolist():
            pair_df = self.backtest_df[self.backtest_df["pair"] == pair]
            for shift_col in ["prediction", "model_buy", "is_valid_trade"]:
                pair_df[shift_col] = pair_df[shift_col].shift(1).fillna(0)
            final_df = pd.concat([final_df, pair_df])
        self.backtest_df = final_df.sort_values(by=["pair"]).reset_index(drop=True)

    def backtest(self, confidence_threshold: float = 0.5) -> float:
        self.reset()
        model = pickle.load(open(self.model_path, "rb"))
        self.backtest_df.insert(
            0,
            "prediction",
            model.predict_proba(self.datasets["test"]["x"])[:, 1],
        )
        self.backtest_df.insert(
            0,
            "model_buy",
            self.backtest_df["prediction"] > confidence_threshold,
        )
        self.backtest_df.insert(0, "is_valid_trade", self.datasets["test"]["y"])
        self.align_in_time()
        self.backtest_df.replace({True: 1, False: 0}, inplace=True)
        self.backtest_df.insert(
            0, "pnl", self.backtest_df.apply(lambda x: self.get_pnl(x), axis=1)
        )
        self.backtest_df.insert(
            0, "usd_pnl", self.backtest_df.apply(self.update_balance, axis=1)
        )
        self.backtest_df.insert(
            0, "cumulative_pnl", self.backtest_df["usd_pnl"].cumsum()
        )
        self.backtest_df.drop(self.backtest_df.tail(1).index, inplace=True)
        return (self.balance / self.starting_balance) - 1


async def run_backtest(test_multiple_thresholds: bool):
    dataset = TrainingDataset(force_refresh=False)
    backtest_df = dataset.load_training_dataset()
    backtest = BackTest(backtest_df=backtest_df)
    threshold_range = range(1, 101) if test_multiple_thresholds else [50]
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
    with open(f"{backtest.assets_path}/{backtest.model_name}_metadata.txt", "a") as f:
        f.write(metadata_content)
    print(df.to_string(index=False))


if __name__ == "__main__":
    asyncio.run(
        run_backtest(
            test_multiple_thresholds=True,
        )
    )
