import pickle

import pandas as pd

from services.ai.train import TrainWithOptimization


class BackTest(TrainWithOptimization):
    starting_balance: int = 1000

    def __init__(self):
        super().__init__()
        self.balance = self.starting_balance

    def get_pnl(self, row: pd.Series):
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
        self.X_test.insert(0, "prediction", model.predict_proba(self.X_test)[:, 1])
        self.X_test.insert(
            0, "model_buy", self.X_test["prediction"] > confidence_threshold
        )
        self.X_test.insert(0, "is_valid_trade", self.y_test)
        for shift_col in ["prediction", "is_valid_trade"]:
            self.X_test[shift_col] = self.X_test[shift_col].shift(1)
        self.X_test.insert(
            0, "pnl", self.X_test.apply(lambda x: self.get_pnl(x), axis=1)
        )
        self.X_test.insert(0, "usd_pnl", self.X_test.apply(self.update_balance, axis=1))
        self.X_test.insert(0, "cumulative_pnl", self.X_test["usd_pnl"].cumsum())
        self.X_test.drop(self.X_test.tail(1).index, inplace=True)


if __name__ == "__main__":
    backtest = BackTest()
    backtest.train()
    # backtest.time_series_cross_validation()
    backtest.backtest()
    final_pnl = backtest.balance / backtest.starting_balance - 1
    print(f"Final P&L is {final_pnl:,.2%}")
