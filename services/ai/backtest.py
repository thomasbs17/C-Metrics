import pickle

import pandas as pd

from services.ai.train import TrainWithOptimization


class BackTest(TrainWithOptimization):
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
    backtest.backtest()
    final_pnl = backtest.X_test["cumulative_pnl"].iloc[-1] / backtest.starting_balance
    print(f"Final P&L is {final_pnl:,.2%}")
