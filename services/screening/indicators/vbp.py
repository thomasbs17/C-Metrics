import pandas as pd


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
