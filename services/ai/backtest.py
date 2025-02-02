import pickle

import pandas as pd

from services.ai.train import Train


class BackTest(Train):
    starting_balance: int = 1000
    balance: int
    backtest_df: pd.DataFrame

    def __init__(self, with_training: bool):
        super().__init__()
        if with_training:
            self.train()
        self.reset()

    def reset(self):
        self.balance = self.starting_balance
        self.backtest_df = self.X_test.copy(deep=True)

    def get_pnl(self, row: pd.Series):
        row.fillna(False, inplace=True)
        if row["model_buy"]:
            if row["day_drawdown"] < self.stop_loss:
                return self.stop_loss
            if row["day_peak"] > self.take_profit:
                return self.take_profit
            return row["day_return"]
        return 0

    def update_balance(self, row: pd.Series) -> float:
        updated_balance = self.balance * (row["pnl"] + 1)
        pnl = updated_balance - self.balance
        self.balance = updated_balance
        return pnl

    def backtest(self, confidence_threshold: float = 0.5):
        model = pickle.load(open(self.model_path, "rb"))
        self.backtest_df.insert(
            0, "prediction", model.predict_proba(self.backtest_df)[:, 1]
        )
        self.backtest_df.insert(
            0,
            "model_buy",
            (self.backtest_df["prediction"] > confidence_threshold).replace(
                {True: 1, False: 0}
            ),
        )
        self.backtest_df.insert(0, "is_valid_trade", self.y_test)
        for shift_col in ["prediction", "model_buy", "is_valid_trade"]:
            self.backtest_df[shift_col] = self.backtest_df[shift_col].shift(1).fillna(0)
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


def run_backtest(multiple_thresholds: bool):
    backtest = BackTest(with_training=False)
    threshold_range = range(1, 101) if multiple_thresholds else [50]
    for threshold in threshold_range:
        backtest.reset()
        threshold /= 100
        backtest.backtest(confidence_threshold=threshold)
        final_pnl = backtest.balance / backtest.starting_balance - 1
        print(f"Threshold {threshold:,.0%} -> Final P&L is {final_pnl:,.2%}")


if __name__ == "__main__":
    run_backtest(multiple_thresholds=False)
