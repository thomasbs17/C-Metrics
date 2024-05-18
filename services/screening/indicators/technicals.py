import numpy as np
import pandas as pd


class FractalCandlestickPattern:
    def __init__(self, df: pd.DataFrame):
        self.df = df.reset_index(drop=True)
        self.levels = []
        self.output = []

    def is_support(self, i):
        cond1 = self.df["low"][i] < self.df["low"][i - 1]
        cond2 = self.df["low"][i] < self.df["low"][i + 1]
        cond3 = self.df["low"][i + 1] < self.df["low"][i + 2]
        cond4 = self.df["low"][i - 1] < self.df["low"][i - 2]
        return cond1 and cond2 and cond3 and cond4

    def is_resistance(self, i):
        cond1 = self.df["high"][i] > self.df["high"][i - 1]
        cond2 = self.df["high"][i] > self.df["high"][i + 1]
        cond3 = self.df["high"][i + 1] > self.df["high"][i + 2]
        cond4 = self.df["high"][i - 1] > self.df["high"][i - 2]
        return cond1 and cond2 and cond3 and cond4

    # to make sure the new level area does not exist already
    def is_far_from_level(self, value, levels):
        ave = np.mean(self.df["high"] - self.df["low"])
        nearest_levels = [level for _, level in levels if abs(value - level) < ave]
        return len(nearest_levels) == 0

    def handle_level(self, i: int):
        level = self.df["high"][i]
        is_far_from_level = self.is_far_from_level(level, self.levels)
        if is_far_from_level:
            self.levels.append((i, level))
            self.output.append(level)

    def run(self):
        for i in range(2, len(self.df) - 2):
            if self.is_support(i) or self.is_resistance(i):
                self.handle_level(i)
        return self.output


def get_vbp(ohlcv: pd.DataFrame, periods: int = 30) -> pd.DataFrame:
    """
    Volume by price
    """
    last_close = ohlcv["close"].iloc[-1]
    ohlcv["volume_type"] = ohlcv.apply(
        lambda row: "positive" if row["close"] > row["open"] else "negative", axis=1
    )
    ohlcv["price_bin"] = pd.qcut(ohlcv["close"], q=periods, duplicates="drop")
    volume_by_type = (
        ohlcv.groupby(["price_bin", "volume_type"])["volume"]
        .sum()
        .unstack()
        .fillna(0)
        .reset_index()
    )
    total_volume = ohlcv.groupby("price_bin")["volume"].sum().reset_index()
    vbp = pd.merge(total_volume, volume_by_type, on="price_bin")
    vbp["close"] = vbp["price_bin"].apply(lambda x: min(x.left, x.right))
    vbp["level_type"] = vbp["close"].apply(
        lambda x: "support" if x < last_close else "resistance"
    )
    vbp.drop(columns="price_bin", inplace=True)
    vbp["volume"] = vbp["negative"] + vbp["positive"]
    return vbp.sort_values(by="volume", ascending=False)
