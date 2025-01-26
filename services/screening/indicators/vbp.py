import pandas as pd


def get_vbp(ohlcv: pd.DataFrame, periods: int = 30) -> pd.DataFrame:
    """Volume by price"""
    ohlcv["volume_type"] = ohlcv.apply(
        lambda row: "positive" if row["close"] > row["open"] else "negative", axis=1
    )
    ohlcv["price_bin"] = pd.cut(ohlcv["close"], bins=periods)
    volume_by_type = (
        ohlcv.groupby(["price_bin", "volume_type"])["volume"]
        .sum()
        .unstack()
        .fillna(0)
        .reset_index()
    )
    total_volume = ohlcv.groupby("price_bin")["volume"].sum().reset_index()
    vbp = pd.merge(total_volume, volume_by_type, on="price_bin")
    vbp = vbp.rename(columns={"close": "price"})
    vbp["price"] = vbp["price_bin"].apply(lambda x: min(x.left, x.right))
    last_close = ohlcv["close"].iloc[-1]
    vbp["level_type"] = vbp["price"].apply(
        lambda x: "support" if x < last_close else "resistance"
    )
    vbp.drop(columns="price_bin", inplace=True)
    vbp = vbp[vbp["volume"] > 0]
    return vbp.sort_values(by="volume", ascending=False)
