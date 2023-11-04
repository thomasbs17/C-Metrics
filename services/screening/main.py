import asyncio
import math
import multiprocessing
import threading
import time
from datetime import timedelta, date, datetime as dt

import ccxt
import pandas as pd
import pandas_ta as ta
import websockets

from indicators.technicals import FractalCandlestickPattern


class Screener:
    def __init__(
        self,
        exchange_list: list = None,
        ref_currency: str = "USD",
        live_refresh_second_frequency: int = 10,
        verbose: bool = False,
    ):
        self.verbose = verbose
        self.clients = set()
        if not exchange_list:
            exchange_list = ccxt.exchanges
        self.live_refresh_second_frequency = live_refresh_second_frequency
        self.exchange_list = exchange_list
        self.ref_currency = ref_currency
        start_tmstmp = dt.now() - timedelta(days=1)
        self.data = dict(
            refresh_tmstmp=dict(live=start_tmstmp, daily=start_tmstmp.date()),
            exchanges=dict(),
        )

    async def daily_refresh(self, exchange: ccxt.Exchange, symbols: dict):
        if date.today() != self.data["refresh_tmstmp"]["daily"]:
            self.daily_data_refresh(exchange, symbols)
            self.daily_indicators_refresh(exchange, symbols, multi_process=False)
            self.data["refresh_tmstmp"]["daily"] = date.today()

    def daily_data_refresh(self, exchange: ccxt.Exchange, symbols: dict):
        threads = []
        for pair, details in symbols.items():
            if self.ref_currency and details["quote"] == self.ref_currency:
                # self.get_pair_ohlcv(exchange, pair)
                thread = threading.Thread(
                    target=self.get_pair_ohlcv, args=(exchange, pair)
                )
                threads.append(thread)
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

    def daily_indicators_refresh(
        self, exchange: ccxt.Exchange, symbols: dict, multi_process: bool
    ):
        if multi_process:
            cpu_amount = multiprocessing.cpu_count() - 2
            symbols_per_process = math.ceil(len(symbols) / cpu_amount)
            sub_lists = [
                {
                    key: symbols[key]
                    for key in list(symbols)[i : i + symbols_per_process]
                }
                for i in range(0, len(symbols), symbols_per_process)
            ]
            with multiprocessing.Pool(processes=cpu_amount) as pool:
                pool.starmap(
                    self._daily_indicators_refresh,
                    [(exchange, symbols) for symbols in sub_lists],
                )
        else:
            self._daily_indicators_refresh(exchange, symbols)

    def _daily_indicators_refresh(self, exchange: ccxt.Exchange, symbols: dict):
        for pair, details in symbols.items():
            if self.ref_currency and details["quote"] == self.ref_currency:
                if self.verbose:
                    print(f"Computing indicators for {pair}")
                if pair not in self.data["exchanges"][exchange.name]:
                    self.data["exchanges"][exchange.name][pair] = dict(
                        data=dict(), indicators=dict()
                    )
                self.add_technical_indicators(exchange, pair)
                self.data["exchanges"][exchange.name][pair]["indicators"][
                    "fractals"
                ] = FractalCandlestickPattern(
                    self.data["exchanges"][exchange.name][pair]["data"]["ohlc"]
                ).run()

    def add_technical_indicators(self, exchange: ccxt.Exchange, pair: str):
        ohlc = self.data["exchanges"][exchange.name][pair]["data"]["ohlc"]
        if len(ohlc) > 20:
            for period in (20, 50, 100, 200):
                for ma_type in ("sma", "ema"):
                    func = getattr(ta, ma_type)
                    key = f"{ma_type}_{period}"
                    self.data["exchanges"][exchange.name][pair]["data"]["ohlc"][key] = func(
                        ohlc["close"], length=period
                    )
            bbands_df = ta.bbands(ohlc["close"])
            columns = [column for column in bbands_df.columns]
            self.data["exchanges"][exchange.name][pair]["data"]["ohlc"][columns] = bbands_df
            self.data["exchanges"][exchange.name][pair]["data"]["ohlc"]["rsi"] = ta.rsi(
                ohlc["close"]
            )

    def get_pair_ohlcv(self, exchange: ccxt.Exchange, pair: str):
        # Only works with multithreading when using openssl 1.1.1
        # https://askubuntu.com/questions/1403837/how-do-i-use-openssl-1-1-1-in-ubuntu-22-04
        # http://security.ubuntu.com/ubuntu/pool/main/o/openssl/
        if self.verbose:
            print(f"Downloading OHLCV data for {pair}")
        if pair not in self.data["exchanges"][exchange.name]:
            self.data["exchanges"][exchange.name][pair] = dict(
                data=dict(), indicators=dict()
            )
        ohlc_data = exchange.fetch_ohlcv(symbol=pair, timeframe="1d", limit=300)
        ohlc_data = pd.DataFrame(
            data=ohlc_data,
            columns=["timestamp", "open", "high", "low", "close", "volume"],
        )
        self.data["exchanges"][exchange.name][pair]["data"]["ohlc"] = ohlc_data

    async def live_refresh(self, exchange: ccxt.Exchange, symbols: dict):
        time_diff = dt.now() - self.data["refresh_tmstmp"]["live"]
        time_diff = (time_diff.days * 24 * 60 * 60) + time_diff.seconds
        if time_diff > self.live_refresh_second_frequency:
            self.live_data_refresh(exchange, symbols)
            self.live_indicators_refresh(exchange, symbols)
            self.data["refresh_tmstmp"]["live"] = dt.now()

    def live_data_refresh(self, exchange: ccxt.Exchange, symbols: dict):
        threads = []
        for pair, details in symbols.items():
            if self.ref_currency and details["quote"] == self.ref_currency:
                if pair not in self.data["exchanges"][exchange.name]:
                    self.data["exchanges"][exchange.name][pair] = dict(
                        data=dict(), indicators=dict()
                    )
                thread = threading.Thread(
                    target=self.get_pair_book,
                    args=(exchange, pair),
                )
                threads.append(thread)
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

    def get_pair_book(self, exchange: ccxt.Exchange, pair: str):
        if self.verbose:
            print(f"Downloading Order Book data for {pair}")
        self.data["exchanges"][exchange.name][pair]["data"][
            "book"
        ] = exchange.fetch_order_book(symbol=pair, limit=100)

    def live_indicators_refresh(self, exchange: ccxt.Exchange, symbols: dict):
        self.data["exchanges"][exchange.name]["scores"] = self.get_scoring(
            exchange, symbols
        )

    def get_book_scoring(
        self, exchange: ccxt.Exchange, pair: str, depth: int = 50
    ) -> float:
        pair_book = self.data["exchanges"][exchange.name][pair]["data"]["book"]
        columns = ["price", "volume", "timestamp"]
        bids = pd.DataFrame(pair_book["bids"], columns=columns).head(depth)
        asks = pd.DataFrame(pair_book["asks"], columns=columns).head(depth)
        spread = asks.loc[0, "price"] / bids.loc[0, "price"]
        return (bids["volume"].sum() / asks["volume"].sum()) / spread

    def score_pair(self, exchange: ccxt.Exchange, pair: str) -> dict:
        levels = self.data["exchanges"][exchange.name][pair]["indicators"]["fractals"]
        ohlc = self.data["exchanges"][exchange.name][pair]["data"]["ohlc"]
        last_close = ohlc.loc[len(ohlc) - 1, "close"]
        supports = [level for level in levels if level < last_close]
        resistances = [level for level in levels if level > last_close]
        details = dict()
        if supports and resistances:
            details["next_support"] = float(max(supports))
            details["next_resistance"] = float(min(resistances))
            details["potential_gain"] = (
                details["next_resistance"] / details["next_support"]
            ) - 1
            if details["next_support"]:
                details["distance_to_rsi"] = ohlc.loc[len(ohlc) - 1, "rsi"] / 30
                details["distance_to_lower_bollinger"] = (
                    last_close / ohlc.loc[len(ohlc) - 1, "BBL_5_2.0"]
                )
                details["distance_to_next_support"] = (
                    last_close / details["next_support"]
                )
                details["book_score"] = self.get_book_scoring(exchange, pair)
                details["technicals_score"] = 1 / (
                    details["distance_to_rsi"]
                    * details["distance_to_lower_bollinger"]
                    * details["distance_to_next_support"]
                )
                details["pair"] = pair
        return details

    def get_scoring(self, exchange: ccxt.Exchange, symbols: dict) -> pd.DataFrame:
        scores = pd.DataFrame()
        for pair, details in symbols.items():
            if self.ref_currency and details["quote"] == self.ref_currency:
                pair_score = self.score_pair(exchange, pair)
                if pair_score:
                    pair_score_df = pd.DataFrame([pair_score])
                    scores = pd.concat([scores, pair_score_df])
        scores["book_score"] = scores["book_score"].apply(
            lambda x: x / scores["book_score"].max()
        )
        book_weight = 0.2
        technicals_weight = 0.8
        scores["score"] = scores.apply(
            lambda x: (x["book_score"] * book_weight)
            + (x["technicals_score"] * technicals_weight),
            axis=1,
        )
        return scores.sort_values(by="score", ascending=False)

    async def print_scores(self, exchange: str, top_score_amount: int = 10):
        top_scores = self.data["exchanges"][exchange]["scores"].head(top_score_amount)
        print(top_scores.to_string())

    async def run_screening(self, websocket=None):
        while True:
            for exchange in self.exchange_list:
                exchange_object = getattr(ccxt, exchange)()
                symbols = exchange_object.load_markets()
                if exchange_object.name not in self.data["exchanges"]:
                    self.data["exchanges"][exchange_object.name] = dict()
                await self.daily_refresh(exchange_object, symbols)
                await self.live_refresh(exchange_object, symbols)
                if self.verbose:
                    print(
                        f"Next iteration in {self.live_refresh_second_frequency} seconds"
                    )
                    await self.print_scores(exchange_object.name)
                if websocket:
                    ws_data = self.data["exchanges"][exchange_object.name][
                        "scores"
                    ].to_json(orient="records")
                    await websocket.send(ws_data)
                    await asyncio.sleep(10)

    async def send_updates_to_clients(self, websocket, exchange_name):
        # Your logic to send updates to clients
        scores_data = self.data["exchanges"][exchange_name].get("scores", "")
        await websocket.send(scores_data)


def run_websocket():
    screener = Screener(exchange_list=["kraken"], verbose=False)
    start_server = websockets.serve(screener.run_screening, "localhost", 8767)
    asyncio.get_event_loop().run_until_complete(start_server)
    asyncio.get_event_loop().run_forever()


if __name__ == "__main__":
    run_websocket()
