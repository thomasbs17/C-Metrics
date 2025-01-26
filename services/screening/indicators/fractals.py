from typing import Literal

import numpy as np
import pandas as pd


class FractalCandlestickPattern:
    def __init__(self, df: pd.DataFrame):
        self.df = df.reset_index(drop=True)
        self.levels = []
        self.output = []
        self.run()

    def is_far_from_level(self, value, levels):
        # Vectorized distance calculation to check for nearby levels
        ave = np.mean(self.df["high"] - self.df["low"])
        return all(abs(value - level) >= ave for _, level in levels)

    def run(self):
        # Pre-compute conditions for support and resistance in vectorized form
        lows = self.df["low"].values
        highs = self.df["high"].values

        is_support = (
            (lows[2:-2] < lows[1:-3])
            & (lows[2:-2] < lows[3:-1])
            & (lows[3:-1] < lows[4:])
            & (lows[1:-3] < lows[:-4])
        )

        is_resistance = (
            (highs[2:-2] > highs[1:-3])
            & (highs[2:-2] > highs[3:-1])
            & (highs[3:-1] > highs[4:])
            & (highs[1:-3] > highs[:-4])
        )

        # Combine support and resistance levels
        is_level = is_support | is_resistance
        candidate_indices = np.where(is_level)[0] + 2  # Adjust for slicing offset

        # Loop through candidates to filter based on proximity
        for i in candidate_indices:
            level = highs[i] if is_resistance[i - 2] else lows[i]  # Determine high/low
            if self.is_far_from_level(level, self.levels):
                self.levels.append((i, level))
                self.output.append(level)

        return self.output

    def get_level(self, level: Literal["support", "resistance"]) -> float:
        last_close = self.df["close"].iloc[-1]
        if level == "support":
            return max(
                (level for level in self.output if level < last_close), default=0
            )
        elif level == "resistance":
            return min(
                (level for level in self.output if level > last_close),
                default=999999999,
            )
