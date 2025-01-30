import asyncio
import logging
import os
import sys
import warnings
from datetime import datetime

import numpy as np
import pandas as pd
import requests
import talib
import yfinance as yf
from ccxt import BadSymbol
from dotenv import load_dotenv
from sqlalchemy import sql
from sqlalchemy.exc import ProgrammingError

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from services.screening.indicators.fractals import FractalCandlestickPattern
from services.screening.indicators.vbp import get_vbp
from utils import helpers

load_dotenv(helpers.ENV_PATH, verbose=True)
warnings.filterwarnings("ignore")


class TrainingDataset:
    pair_df: pd.DataFrame

    stop_loss: float = 0.02
    take_profit: float = 0.05

    greed_and_fear: pd.DataFrame = None
    open_interest: pd.DataFrame = None
    funding_rates: pd.DataFrame = None
    long_short_ratio: pd.DataFrame = None
    liquidations: pd.DataFrame = None

    bitcoin_dominance: pd.DataFrame = None
    btc_returns: pd.DataFrame = None
    vix: pd.DataFrame = None

    nfp: pd.DataFrame = None
    fed_decisions: pd.DataFrame = None

    btc_usd: pd.DataFrame = None
    eth_usd: pd.DataFrame = None
    btc_eth_correlation: pd.DataFrame = None

    gold_returns: pd.DataFrame = None
    nasdaq_returns: pd.DataFrame = None

    def __init__(self, force_refresh: bool):
        self.log = self.get_logger()
        self.force_refresh = force_refresh
        self.db = helpers.get_db_connection()
        self.available_pairs = self.get_available_pairs()

    @staticmethod
    def get_logger() -> logging.Logger:
        logging.basicConfig(format="%(asctime)s %(message)s", level=logging.INFO)
        return logging.getLogger("training-dataset")

    @staticmethod
    def call_coinmarket_cap(endpoint: str) -> dict:
        endpoint = f"https://pro-api.coinmarketcap.com/v1/cryptocurrency/{endpoint}"
        headers = {"X-CMC_PRO_API_KEY": os.environ.get("COIN_MARKET_CAP_API_KEY")}
        resp = requests.get(url=endpoint, headers=headers)
        return resp.json()["data"]

    def get_stable_coins_categories(self) -> list[str]:
        data = self.call_coinmarket_cap("categories")
        stable_coins_category_id = list()
        for category in data:
            if "STABLE" in str(category).upper():
                stable_coins_category_id.append(category["id"])
        return stable_coins_category_id

    def get_stable_coins(self) -> list[str]:
        id_list = self.get_stable_coins_categories()
        coins = list()
        for category_id in id_list:
            data = self.call_coinmarket_cap(f"category?id={category_id}")
            for coin in data["coins"]:
                coins.append(coin["symbol"])
        return coins

    def get_available_pairs(self) -> dict:
        self.log.info("Retrieving available pairs")
        exchanges = ["binance", "coinbase"]
        pairs = dict()
        stable_coins = self.get_stable_coins()
        for exchange in exchanges:
            exchange_object = helpers.get_exchange_object(exchange, async_mode=False)
            exchange_pairs = exchange_object.load_markets()
            for pair, pair_details in exchange_pairs.items():
                base = pair_details["base"]
                quote = pair_details["quote"]
                if (
                    any(quote == usd for usd in ("USD", "USDC", "USDT"))
                    and base not in stable_coins
                    and pair_details["type"] == "spot"
                ):
                    if base not in pairs:
                        pairs[base] = list()
                    if pair not in pairs[base]:
                        pairs[base].append(pair)
        self.log.info(f"{len(pairs)} available pairs")
        return pairs

    async def get_pair_ohlcv(self, asset: str) -> pd.DataFrame:
        if asset == "BTC" and self.btc_usd is not None:
            return self.btc_usd
        if asset == "ETH" and self.eth_usd is not None:
            return self.eth_usd
        final_df = pd.DataFrame()
        final_pair = None
        final_exchange = None
        for exchange in ("binance", "coinbase"):
            pairs = self.available_pairs[asset]
            for pair in pairs:
                try:
                    exchange_object = helpers.get_exchange_object(
                        exchange, async_mode=False
                    )
                    ohlcv_data = helpers.get_ohlcv_history(
                        pair=pair,
                        exchange=exchange_object,
                        timeframe="1d",
                        full_history=True,
                    )
                    self.log.info(f"    Checking {exchange}: {pair}")
                    df = pd.DataFrame(
                        ohlcv_data,
                        columns=["timestamp", "open", "high", "low", "close", "volume"],
                    )
                    df["timestamp"] = pd.to_datetime(
                        df["timestamp"], utc=True, unit="ms"
                    ).dt.date
                    df.sort_values(by="timestamp", inplace=True)
                    df.drop_duplicates(inplace=True)
                    full_date_range = pd.date_range(
                        start=df["timestamp"].min(), end=df["timestamp"].max()
                    )
                    missing_dates = full_date_range.difference(df["timestamp"])
                    if not missing_dates.empty:
                        self.log.info(f"    {len(missing_dates)} missing dates")
                        df = (
                            df.set_index("timestamp")
                            .reindex(full_date_range)
                            .reset_index()
                        )
                        df.rename(columns={"index": "timestamp"}, inplace=True)
                        df["timestamp"] = pd.to_datetime(
                            df["timestamp"], utc=True, unit="ms"
                        ).dt.date
                    if final_df.empty or len(df.dropna()) >= len(final_df.dropna()):
                        final_pair = pair
                        final_exchange = exchange
                        final_df = df
                except BadSymbol:
                    pass
        self.log.info(
            f"    Pair with the most amount of data is {final_exchange}: {final_pair}"
        )
        final_df = final_df[1:-1]
        if asset == "BTC":
            self.btc_usd = final_df
        if asset == "ETH":
            self.eth_usd = final_df
        return final_df

    def add_returns(self, periods: list[int]):
        for period in periods:
            self.pair_df.loc[:, f"{period}d_return"] = self.pair_df["close"].pct_change(
                periods=period
            )

    def add_patterns(self):
        # https://github.com/TA-Lib/ta-lib-python/blob/master/docs/func_groups/pattern_recognition.md
        self.log.info("Adding trading patterns")
        pattern_list = [
            "CDL2CROWS",
            "CDL3BLACKCROWS",
            "CDL3INSIDE",
            "CDL3LINESTRIKE",
            "CDL3OUTSIDE",
            "CDL3STARSINSOUTH",
            "CDL3WHITESOLDIERS",
            "CDLABANDONEDBABY",
            "CDLADVANCEBLOCK",
            "CDLBELTHOLD",
            "CDLBREAKAWAY",
            "CDLCLOSINGMARUBOZU",
            "CDLCONCEALBABYSWALL",
            "CDLCOUNTERATTACK",
            "CDLDARKCLOUDCOVER",
            "CDLDOJI",
            "CDLDOJISTAR",
            "CDLDRAGONFLYDOJI",
            "CDLENGULFING",
            "CDLEVENINGDOJISTAR",
            "CDLEVENINGSTAR",
            "CDLGAPSIDESIDEWHITE",
            "CDLGRAVESTONEDOJI",
            "CDLHAMMER",
            "CDLHANGINGMAN",
            "CDLHARAMI",
            "CDLHARAMICROSS",
            "CDLHIGHWAVE",
            "CDLHIKKAKE",
            "CDLHIKKAKEMOD",
            "CDLHOMINGPIGEON",
            "CDLIDENTICAL3CROWS",
            "CDLINNECK",
            "CDLINVERTEDHAMMER",
            "CDLKICKING",
            "CDLKICKINGBYLENGTH",
            "CDLLADDERBOTTOM",
            "CDLLONGLEGGEDDOJI",
            "CDLLONGLINE",
            "CDLMARUBOZU",
            "CDLMATCHINGLOW",
            "CDLMATHOLD",
            "CDLMORNINGDOJISTAR",
            "CDLMORNINGSTAR",
            "CDLONNECK",
            "CDLPIERCING",
            "CDLRICKSHAWMAN",
            "CDLRISEFALL3METHODS",
            "CDLSEPARATINGLINES",
            "CDLSHOOTINGSTAR",
            "CDLSHORTLINE",
            "CDLSPINNINGTOP",
            "CDLSTALLEDPATTERN",
            "CDLSTICKSANDWICH",
            "CDLTAKURI",
            "CDLTASUKIGAP",
            "CDLTHRUSTING",
            "CDLTRISTAR",
            "CDLUNIQUE3RIVER",
            "CDLUPSIDEGAP2CROWS",
            "CDLXSIDEGAP3METHODS",
        ]
        for pattern in pattern_list:
            self.pair_df[pattern] = getattr(talib, pattern)(
                self.pair_df["open"],
                self.pair_df["high"],
                self.pair_df["low"],
                self.pair_df["close"],
            )

    def add_death_cross_pattern(self) -> pd.DataFrame:
        self.pair_df["sma_50_below_sma_200"] = (
            self.pair_df["sma_50"] < self.pair_df["sma_200"]
        )
        self.pair_df["death_cross"] = self.pair_df["sma_50_below_sma_200"] & (
            ~self.pair_df["sma_50_below_sma_200"].shift(1, fill_value=False)
        )
        self.pair_df.drop(columns=["sma_50_below_sma_200"], inplace=True)
        return self.pair_df

    def get_greed_and_fear(self):
        if self.greed_and_fear is None:
            url = "https://api.alternative.me/fng/?limit=0"
            resp = requests.get(url)
            resp_json = resp.json()
            df = pd.DataFrame(resp_json["data"])
            df = df[["value", "timestamp"]]
            df = df.rename(columns={"value": "greed_and_fear_index"})
            # self.pair_df['timestamp'] = pd.to_datetime(self.pair_df['timestamp'], utc=True).dt.date
            df["timestamp"] = pd.to_datetime(
                df["timestamp"].astype(int), unit="s"
            ).dt.date
            # self.pair_df = self.pair_df.merge(df, how='left', on='timestamp')
            self.greed_and_fear = df

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

    def is_valid_trade(
        self,
        next_day_open: float,
        next_day_low: float,
        next_day_high: float,
        next_day_close: float,
    ) -> bool:
        next_day_drawdown = next_day_low / next_day_open - 1
        next_day_peak = next_day_high / next_day_open - 1
        if (
            next_day_peak >= self.take_profit and next_day_drawdown <= self.stop_loss
            # and next_day_close > next_day_open
        ):
            return True
        return False

    def add_valid_trades(self):
        self.log.info("Adding valid trades")
        self.pair_df["next_open"] = self.pair_df["open"].shift(-1)
        self.pair_df["next_high"] = self.pair_df["high"].shift(-1)
        self.pair_df["next_low"] = self.pair_df["low"].shift(-1)
        self.pair_df["next_close"] = self.pair_df["close"].shift(-1)
        self.pair_df["is_valid_trade"] = self.pair_df.apply(
            lambda row: self.is_valid_trade(
                row["next_open"], row["next_low"], row["next_high"], row["next_close"]
            ),
            axis=1,
        )
        self.pair_df.drop(
            columns=["next_open", "next_high", "next_low", "next_close"], inplace=True
        )

    @staticmethod
    def classify_trend(row):
        if row["SMA_short"] > row["SMA_mid"] > row["SMA_long"]:
            return "BULLISH"
        elif row["SMA_short"] < row["SMA_mid"] < row["SMA_long"]:
            return "BEARISH"
        else:
            return "NEUTRAL"

    def add_current_trend(self):
        """
        Define short, mid, and long-term trends based on moving averages
        """
        # Calculate moving averages for short, mid, and long terms
        self.pair_df["SMA_short"] = (
            self.pair_df["close"].rolling(window=50).mean()
        )  # Short-term (50 periods)
        self.pair_df["SMA_mid"] = (
            self.pair_df["close"].rolling(window=100).mean()
        )  # Mid-term (100 periods)
        self.pair_df["SMA_long"] = (
            self.pair_df["close"].rolling(window=200).mean()
        )  # Long-term (200 periods)
        self.pair_df["short_term_trend"] = self.pair_df.apply(
            lambda row: self.classify_trend(row), axis=1
        )
        self.pair_df.drop(columns=["SMA_short", "SMA_mid", "SMA_long"], inplace=True)

    @staticmethod
    def call_coinalyze_api(
        endpoint: str,
        symbols: str,
        from_date_unix: int = None,
        to_date_unix: int = None,
    ) -> pd.DataFrame:
        """https://api.coinalyze.net/v1/doc/"""

        coinalyze_key = os.environ.get("COINALYZE_API_KEY")
        if not from_date_unix:
            from_date_unix = 1514764800  # 2018-01-01
        if not to_date_unix:
            to_date_unix = 1735603200  # 2024-12-31
        endpoint = (
            f"https://api.coinalyze.net/v1/{endpoint}?"
            f"symbols={symbols}&"
            f"interval=daily&"
            f"from={from_date_unix}&"
            f"to={to_date_unix}"
        )
        if endpoint in ("open-interest-history", "liquidation-history"):
            endpoint += "&convert_to_usd=true"
        resp = requests.get(url=endpoint, headers={"api_key": coinalyze_key})
        resp_json = resp.json()
        df = pd.DataFrame(resp_json[0]["history"])
        df = df.rename(columns={"t": "timestamp"})
        df["timestamp"] = pd.to_datetime(df["timestamp"], unit="s").dt.date
        return df

    def get_open_interest_history(self):
        if self.open_interest is None:
            df = self.call_coinalyze_api(
                endpoint="open-interest-history", symbols="BTCUSDT_PERP.A"
            )
            df = df[["timestamp", "c"]]
            df = df.rename(columns={"c": "btc_usd_open_interest"})
            self.open_interest = df

    def get_funding_rate_history(self):
        if self.funding_rates is None:
            df = self.call_coinalyze_api(
                endpoint="funding-rate-history", symbols="BTCUSDT_PERP.A"
            )
            df = df[["timestamp", "c"]]
            df = df.rename(columns={"c": "btc_usd_funding_rate"})
            df = df[["timestamp", "btc_usd_funding_rate"]]
            self.funding_rates = df

    def get_liquidations_history(self):
        if self.liquidations is None:
            self.liquidations = self.call_coinalyze_api(
                endpoint="liquidation-history", symbols="BTCUSDT_PERP.A"
            )
            self.liquidations = self.liquidations.rename(
                columns={"l": "longs_liquidations", "s": "shorts_liquidations"}
            )

    def get_long_short_ratio_history(self):
        if self.long_short_ratio is None:
            self.long_short_ratio = self.call_coinalyze_api(
                endpoint="long-short-ratio-history", symbols="BTCUSDT_PERP.A"
            )
            self.long_short_ratio = self.long_short_ratio[["timestamp", "r"]]
            self.long_short_ratio = self.long_short_ratio.rename(
                columns={"r": "ls_ratio"}
            )

    @staticmethod
    def days_to_next(df: pd.DataFrame, timestamp: datetime.date) -> int:
        future_dates = df[df["timestamp"] >= timestamp]
        future_dates.sort_values(by="timestamp", inplace=True)
        if not future_dates.empty:
            return (future_dates.iloc[0]["timestamp"] - timestamp).days

    def custom_ffill(self, df: pd.DataFrame, column: str):
        self.pair_df[column] = self.pair_df[column].ffill()
        oldest_ohlcv_value = self.pair_df["timestamp"].min()
        df = df[df["timestamp"] <= oldest_ohlcv_value]
        if not df.empty:
            oldest_metric_value = df.iloc[-1, 1:].item()
            self.pair_df[column] = self.pair_df[column].fillna(oldest_metric_value)

    def add_bitcoin_dominance(self):
        if self.bitcoin_dominance is None:
            self.bitcoin_dominance = pd.read_csv("services/ai/bitcoin_dominance.csv")
            self.bitcoin_dominance["timestamp"] = pd.to_datetime(
                self.bitcoin_dominance["timestamp"], utc=True
            ).dt.date
        self.pair_df = self.pair_df.merge(
            self.bitcoin_dominance, how="left", on="timestamp"
        )
        self.custom_ffill(df=self.bitcoin_dominance, column="bitcoin_dominance")

    async def add_btc_returns(self):
        if self.btc_returns is None:
            self.btc_returns = await self.get_pair_ohlcv("BTC")
            self.btc_returns["btc_return_1d"] = self.btc_returns["close"].pct_change(
                periods=1
            )
            self.btc_returns["btc_return_7d"] = self.btc_returns["close"].pct_change(
                periods=7
            )
            self.btc_returns["btc_return_30d"] = self.btc_returns["close"].pct_change(
                periods=30
            )
            self.btc_returns = self.btc_returns[
                ["timestamp", "btc_return_1d", "btc_return_7d", "btc_return_30d"]
            ]
        self.pair_df = self.pair_df.merge(self.btc_returns, how="left", on="timestamp")

    def add_trend_indicators(self):
        """
        - SMA 50
        - SMA 200
        - EMA 100
        - MACD
        - Current Trend
        - Is Death Cross
        """
        self.log.info("Adding trend indicators")
        self.pair_df["sma_50"] = talib.SMA(self.pair_df["close"], timeperiod=50)
        self.pair_df["sma_200"] = talib.SMA(self.pair_df["close"], timeperiod=200)
        self.pair_df["ema_100"] = talib.EMA(self.pair_df["close"], timeperiod=100)
        self.pair_df["macd"], self.pair_df["macd_signal"], self.pair_df["macd_hist"] = (
            talib.MACD(self.pair_df["close"])
        )
        self.add_current_trend()
        self.add_death_cross_pattern()

    def add_price_indicators(self):
        """
        - Return 1d
        - Return 7d
        - Return 30d
        - Next fractal resistance
        - Has crossed previous day fractal resistance
        - Next fractal support
        - Has crossed previous day fractal support
        - Distance to ATL and ATH
        """
        self.log.info("Adding price indicators")
        self.add_returns(periods=[1, 7, 30])

        all_dates = self.pair_df["timestamp"].unique().tolist()
        final_df = pd.DataFrame()
        for calendar_date in all_dates:
            date_df = self.pair_df[self.pair_df["timestamp"] <= calendar_date]
            fractals = FractalCandlestickPattern(date_df)
            date_df["fractal_support"] = fractals.get_level("support")
            date_df["fractal_resistance"] = fractals.get_level("resistance")
            date_df["has_crossed_fractal_resistance"] = (
                date_df["fractal_resistance"].shift(1) < date_df["high"]
            )
            date_df["has_crossed_fractal_support"] = (
                date_df["fractal_support"].shift(1) > date_df["low"]
            )
            date_df["distance_to_ath"] = date_df["close"] / date_df["high"].max() - 1
            date_df["distance_to_atl"] = date_df["close"] / date_df["low"].min() - 1
            date_df = date_df[date_df["timestamp"] == calendar_date]
            final_df = pd.concat([final_df, date_df])
        self.pair_df = final_df

    def add_derivatives_indicators(self):
        """
        - BTC/USD perp open interest
        - BTC/USD perp funding rate
        - BTC/USD liquidations
        - BTC/USD l/s ratio
        """
        self.log.info("Adding derivatives indicators")
        self.get_open_interest_history()
        self.get_funding_rate_history()
        self.get_liquidations_history()
        self.get_long_short_ratio_history()
        for df in (
            self.open_interest,
            self.funding_rates,
            self.long_short_ratio,
            self.liquidations,
        ):
            self.pair_df = self.pair_df.merge(df, how="left", on="timestamp")

    def add_momentum_indicators(self):
        """
        - RSI
        """
        self.log.info("Adding momentum indicators")
        self.pair_df["rsi"] = talib.RSI(self.pair_df["close"])

    def add_volatility_indicators(self):
        """
        - Historical Volatility
        - High-Low Volatility (Parkinson's Volatility)
        - Fear & Greed Index
        - Fear & Greed Index 1d change
        - VIX
        - Bollinger Bands
        """
        self.log.info("Adding volatility indicators")
        self.pair_df["historical_volatility"] = self.pair_df["1d_return"].rolling(
            window=14
        ).std() * np.sqrt(252)  # Annualized
        self.pair_df["high_low_volatility"] = np.sqrt(
            (1 / (4 * np.log(2)))
            * self.pair_df[["high", "low"]]
            .apply(lambda x: np.log(x["high"] / x["low"]) ** 2, axis=1)
            .rolling(window=14)
            .mean()
        )
        self.get_greed_and_fear()
        self.pair_df = self.pair_df.merge(
            self.greed_and_fear, how="left", on="timestamp"
        )
        self.pair_df["greed_and_fear_index"] = self.pair_df[
            "greed_and_fear_index"
        ].astype(float)
        self.custom_ffill(df=self.greed_and_fear, column="greed_and_fear_index")
        self.pair_df["greed_and_fear_index_change"] = self.pair_df[
            "greed_and_fear_index"
        ].pct_change()
        if self.vix is None:
            self.vix = pd.read_csv("services/ai/vix.csv")
            self.vix["timestamp"] = pd.to_datetime(
                self.vix["timestamp"], format="%d/%m/%Y"
            ).dt.date
        self.pair_df = self.pair_df.merge(self.vix, how="left", on="timestamp")
        self.custom_ffill(df=self.vix, column="vix")
        (
            self.pair_df["bollinger_upper"],
            self.pair_df["bollinger_middle"],
            self.pair_df["bollinger_lower"],
        ) = talib.BBANDS(self.pair_df["close"])

    def add_volume_indicators(self):
        """
        - Volume SMA 50
        - Point of Control
        - Next PoC resistance
        - Has crossed previous day PoC resistance
        - Next PoC support
        - Has crossed previous day PoC support

        """
        self.log.info("Adding volume indicators")
        self.pair_df["volume_smma_50"] = talib.SMA(
            self.pair_df["volume"], timeperiod=50
        )
        all_dates = self.pair_df["timestamp"].unique().tolist()
        final_df = pd.DataFrame()
        for calendar_date in all_dates:
            date_df = self.pair_df[self.pair_df["timestamp"] <= calendar_date]
            last_close = date_df["close"].iloc[-1]
            vbp_df = get_vbp(date_df)
            date_df.drop(columns=["price_bin", "volume_type"], inplace=True)
            vbp_df["price"] = vbp_df["price"].astype(float)
            date_df["poc"] = vbp_df.loc[vbp_df["volume"].idxmax()]["price"]
            date_df["poc_resistance"] = vbp_df.loc[vbp_df["price"] > last_close][
                "price"
            ].min()
            date_df["poc_support"] = vbp_df.loc[vbp_df["price"] < last_close][
                "price"
            ].max()
            date_df["has_crossed_poc_resistance"] = (
                date_df["poc_resistance"].shift(1) < date_df["high"]
            )
            date_df["has_crossed_poc_support"] = (
                date_df["poc_support"].shift(1) > date_df["low"]
            )
            date_df = date_df[date_df["timestamp"] == calendar_date]
            final_df = pd.concat([final_df, date_df])
        self.pair_df = final_df

    async def add_btc_eth_correlation(self):
        if self.btc_eth_correlation is None:
            eth_usd = await self.get_pair_ohlcv("ETH")
            eth_usd["eth_return_1d"] = eth_usd["close"].pct_change(periods=1)
            btc_usd = await self.get_pair_ohlcv("BTC")
            btc_usd["btc_return_1d"] = btc_usd["close"].pct_change(periods=1)
            df = pd.merge(
                btc_usd[["timestamp", "btc_return_1d"]],
                eth_usd[["timestamp", "eth_return_1d"]],
                on="timestamp",
            )
            df["btc_eth_correlation"] = (
                df["btc_return_1d"].rolling(window=14).corr(df["eth_return_1d"])
            )
            df = df[["timestamp", "btc_eth_correlation"]]
            self.eth_usd.drop(columns=["eth_return_1d"], inplace=True)
            self.btc_eth_correlation = df
        self.pair_df = self.pair_df.merge(
            self.btc_eth_correlation, how="left", on="timestamp"
        )

    @staticmethod
    def call_yahoo_finance_api(symbol: str) -> pd.DataFrame:
        df = yf.download(
            symbol, start="2018-01-01", interval="1d", multi_level_index=False
        )
        df.insert(0, "timestamp", df.index)
        df["timestamp"] = df["timestamp"].dt.date
        df = df.reset_index(drop=True)
        asset_name = "gold" if symbol == "GC=F" else "nasdaq"
        df[f"{asset_name}_1d_return"] = df["Close"].pct_change(periods=1)
        df = df[["timestamp", f"{asset_name}_1d_return"]]
        return df

    async def add_market_beta_indicators(self):
        """
        - BTC dominance
        - BTC/USD return 1d
        - BTC/USD return 7d
        - BTC/USD return 30d
        - BTC/ETH correlation
        - Gold return 1d
        - NASDAQ return 1d
        """
        self.log.info("Adding market/beta indicators")
        self.add_bitcoin_dominance()
        await self.add_btc_returns()
        await self.add_btc_eth_correlation()
        if self.gold_returns is None:
            self.gold_returns = self.call_yahoo_finance_api(symbol="GC=F")
        if self.nasdaq_returns is None:
            self.nasdaq_returns = self.call_yahoo_finance_api(symbol="^IXIC")
        for asset in ("gold", "nasdaq"):
            df = getattr(self, f"{asset}_returns")
            self.pair_df = self.pair_df.merge(df, how="left", on="timestamp")
            self.pair_df[f"{asset}_1d_return"] = df[f"{asset}_1d_return"].fillna(0)

    def add_macro_indicators(self):
        """
        - Current US non-form payroll
        - Days to next US non-form payroll
        - Current FOMC rate
        - Days to next FOMC decision
        """
        self.log.info("Adding macro indicators")
        for df_name in ("nfp", "fed_decisions"):
            if getattr(self, df_name) is None:
                setattr(self, df_name, pd.read_csv(f"services/ai/{df_name}.csv"))
            df = getattr(self, df_name)
            df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True).dt.date
            self.pair_df = self.pair_df.merge(df, how="left", on="timestamp")
            self.pair_df = self.pair_df.rename(columns={"actual": df_name})
            self.custom_ffill(df=df, column=df_name)
            self.pair_df[f"days_to_next_{df_name}"] = self.pair_df.apply(
                lambda row: self.days_to_next(df, row["timestamp"]), axis=1
            )

    def add_seasonality(self):
        """
        - day of the week
        - month of the year
        - days to quarter end
        """
        self.log.info("Adding seasonality indicators")
        self.pair_df["timestamp"] = pd.to_datetime(self.pair_df["timestamp"], utc=True)
        self.pair_df["day_of_week"] = self.pair_df["timestamp"].dt.dayofweek
        self.pair_df["month_of_year"] = self.pair_df["timestamp"].dt.month
        self.pair_df["days_to_quarter_end"] = (
            pd.to_datetime(
                self.pair_df["timestamp"].dt.to_period("Q").dt.end_time, utc=True
            )
            - self.pair_df["timestamp"]
        ).dt.days

    def clear_existing_data(self, pair: str):
        query = f"delete from training_data.training_dataset where pair = '{pair}'"
        with self.db.connect() as connection:
            try:
                connection.execute(sql.text(query))
                connection.commit()
            except ProgrammingError:
                self.log.info("'training_data.training_dataset' does not yet exist")

    def should_get_data(self, pair: str) -> bool:
        if self.force_refresh:
            self.clear_existing_data(pair)
            return True
        return False

    async def get_raw_training_dataset(self):
        for asset in self.available_pairs:
            pair = f"{asset}/USD"
            if self.should_get_data(pair):
                self.log.info(f"Processing {pair}")
                self.pair_df = await self.get_pair_ohlcv(asset)
                self.pair_df = self.pair_df.iloc[:100]
                self.pair_df["pair"] = pair

                self.add_valid_trades()

                self.add_trend_indicators()
                self.add_price_indicators()
                self.add_derivatives_indicators()
                self.add_momentum_indicators()
                self.add_volatility_indicators()
                self.add_volume_indicators()
                await self.add_market_beta_indicators()
                self.add_macro_indicators()
                self.add_seasonality()
                self.add_patterns()
                self.transform_ohlcv()
                if self.pair_df["timestamp"].duplicated().any():
                    raise Exception("Duplicates found!")
                self.log.info("Adding to DB")
                self.pair_df.to_sql(
                    "training_dataset",
                    schema="training_data",
                    con=self.db,
                    if_exists="append",
                    index=False,
                )
                self.log.info(f"    {len(self.pair_df)} rows added to training_dataset")


if __name__ == "__main__":
    dataset = TrainingDataset(force_refresh=True)
    asyncio.run(dataset.get_raw_training_dataset())
