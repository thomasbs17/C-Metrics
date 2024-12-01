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
