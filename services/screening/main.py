import asyncio
import json
import os
import sys
from datetime import timedelta, date, datetime as dt

import ccxt.async_support as ccxt
import pandas as pd
import pandas_ta as ta
import websockets

from indicators.technicals import FractalCandlestickPattern

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from utils.helpers import get_exchange_object

WS_URL = "ws://localhost:8768"


class Screener:
    def __init__(
        self,
        exchange_list: list = None,
        ref_currency: str = "USD",
        verbose: bool = False,
        user_symbols_list: list = None,
    ):
        self.verbose = verbose
        self.clients = set()
        self.all_symbols = list()
        self.user_symbols_list = user_symbols_list
        if not exchange_list:
            exchange_list = ccxt.exchanges
        self.exchange_list = exchange_list
        self.ref_currency = ref_currency
        start_tmstmp = dt.now() - timedelta(days=1)
        self.data = dict(
            refresh_tmstmp=dict(daily=start_tmstmp.date()),
            exchanges=dict(),
        )

    async def daily_refresh(self, exchange: ccxt.Exchange, symbols: dict):
        if date.today() != self.data["refresh_tmstmp"]["daily"]:
            await self.daily_data_refresh(exchange, symbols)
            await self.daily_indicators_refresh(exchange, symbols)
            self.data["refresh_tmstmp"]["daily"] = date.today()

    async def daily_data_refresh(self, exchange: ccxt.Exchange, symbols: dict):
        for pair in symbols:
            await self.get_pair_ohlcv(exchange, pair)

    async def daily_indicators_refresh(self, exchange: ccxt.Exchange, symbols: dict):
        exchange_name = exchange.name.lower()
        for pair in symbols:
            if self.verbose:
                print(f"Computing indicators for {pair}")
            self.add_technical_indicators(exchange, pair)
            self.data["exchanges"][exchange_name]["mapping"][pair]["indicators"][
                "fractals"
            ] = FractalCandlestickPattern(
                self.data["exchanges"][exchange_name]["mapping"][pair]["data"]["ohlc"]
            ).run()

    def add_technical_indicators(self, exchange: ccxt.Exchange, pair: str):
        exchange_name = exchange.name.lower()
        ohlc = self.data["exchanges"][exchange_name]["mapping"][pair]["data"]["ohlc"]
        for period in (20, 50, 100, 200):
            for ma_type in ("sma", "ema"):
                func = getattr(ta, ma_type)
                key = f"{ma_type}_{period}"
                self.data["exchanges"][exchange_name]["mapping"][pair]["data"]["ohlc"][
                    key
                ] = func(ohlc["close"], length=period)
        bbands_df = ta.bbands(ohlc["close"])
        if bbands_df is not None:
            columns = [column for column in bbands_df.columns]
            self.data["exchanges"][exchange_name]["mapping"][pair]["data"]["ohlc"][
                columns
            ] = bbands_df
        self.data["exchanges"][exchange_name]["mapping"][pair]["data"]["ohlc"][
            "rsi"
        ] = ta.rsi(ohlc["close"])

    # @run_with_rate_limits
    async def get_pair_ohlcv(self, exchange: ccxt.Exchange, pair: str):
        exchange_name = exchange.name.lower()
        if "data" not in self.data["exchanges"][exchange_name]["mapping"][pair]:
            self.data["exchanges"][exchange_name]["mapping"][pair]["data"] = dict()
            self.data["exchanges"][exchange_name]["mapping"][pair][
                "indicators"
            ] = dict()
        if "ohlc" not in self.data["exchanges"][exchange_name]["mapping"][pair]["data"]:
            if self.verbose:
                print(f"Downloading OHLCV data for {pair}")
            ohlc_data = await exchange.fetch_ohlcv(
                symbol=pair, timeframe="1d", limit=300
            )
            ohlc_data = pd.DataFrame(
                data=ohlc_data,
                columns=["timestamp", "open", "high", "low", "close", "volume"],
            )
            self.data["exchanges"][exchange_name]["mapping"][pair]["data"][
                "ohlc"
            ] = ohlc_data
            self.data["exchanges"][exchange_name]["mapping"][pair]["data"][
                "last"
            ] = ohlc_data.tail(1)["close"].item()

    async def live_refresh(
        self, exchange: ccxt.Exchange, symbols: dict, raw_data: str = None
    ):
        await self.live_data_refresh(exchange, symbols, raw_data)
        await self.live_indicators_refresh(exchange, symbols)

    async def read_ws_message(self, raw_data: dict):
        data = json.loads(raw_data)
        for method in data:
            exchange = data[method]["exchange"].lower()
            pair = data[method]["symbol"].replace("-", "/")
            if self.ref_currency and pair.endswith(self.ref_currency):
                if "data" not in self.data["exchanges"][exchange]["mapping"][pair]:
                    self.data["exchanges"][exchange]["mapping"][pair]["data"] = dict()
                if method == "trades":
                    self.data["exchanges"][exchange]["mapping"][pair]["data"][
                        "last"
                    ] = data[method]["price"]
                if method == "book":
                    self.data["exchanges"][exchange]["mapping"][pair]["data"][
                        "book"
                    ] = data[method][method]

    async def get_pair_book(self, exchange: ccxt.Exchange, pair: str):
        if self.verbose:
            print(f"Downloading Order Book data for {pair}")
        try:
            order_book = await exchange.fetch_order_book(symbol=pair, limit=100)
            self.data["exchanges"][exchange.name.lower()]["mapping"][pair]["data"][
                "book"
            ] = order_book
        except Exception as e:
            print(f"Could not download order book for {pair}: \n {e}")

    async def live_data_refresh(
        self, exchange: ccxt.Exchange, symbols: dict, raw_data: dict
    ):
        if raw_data:
            await self.read_ws_message(raw_data)
        else:
            for symbol in symbols:
                await self.get_pair_book(exchange, symbol)

    async def live_indicators_refresh(self, exchange: ccxt.Exchange, symbols: dict):
        self.data["exchanges"][exchange.name.lower()]["scores"] = self.get_scoring(
            exchange, symbols
        )

    def get_book_scoring(
        self, exchange: ccxt.Exchange, pair: str, depth: int = 50
    ) -> float:
        exchange_name = exchange.name.lower()
        pair_data = self.data["exchanges"][exchange_name]["mapping"][pair]["data"]
        if "book" not in pair_data:
            return 0
        pair_book = pair_data["book"]
        data = dict()
        for side in ("bid", "ask"):
            raw_side = side if side in pair_book else side + "s"
            if isinstance(pair_book[raw_side], list):
                df = pd.DataFrame(pair_book[raw_side], columns=["price", "volume"])
                df.set_index("price", inplace=True)
            else:
                df = pd.DataFrame.from_dict(
                    pair_book[raw_side], orient="index", columns=["volume"]
                )
            data[side] = df
        spread = float(data["ask"].index[0]) / float(data["bid"].index[0])
        return (data["bid"]["volume"].sum() / data["ask"]["volume"].sum()) / spread

    def score_pair(self, exchange: ccxt.Exchange, pair: str) -> dict:
        exchange_name = exchange.name.lower()
        pair_data = self.data["exchanges"][exchange_name]["mapping"][pair]
        levels = pair_data["indicators"]["fractals"]
        ohlc = pair_data["data"]["ohlc"]
        if "last" not in pair_data["data"]:
            last_close = pair_data["data"]["ohlc"].tail(1)["close"].item()
        else:
            last_close = pair_data["data"]["last"]
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
        if not scores.empty:
            scores["book_score"] = scores["book_score"].apply(
                lambda x: x / scores["book_score"].max()
                if scores["book_score"].max() > 0
                else 0
            )
            book_weight = 0.2
            technicals_weight = 0.8
            scores["score"] = scores.apply(
                lambda x: (x["book_score"] * book_weight)
                + (x["technicals_score"] * technicals_weight),
                axis=1,
            )
            return scores.sort_values(by="score", ascending=False)

    def print_scores(self, exchange: str, top_score_amount: int = 10):
        scores = self.data["exchanges"][exchange]["scores"]
        if scores is not None:
            top_scores = scores.head(top_score_amount)
            print(top_scores.to_string())

    async def is_pair_in_scope(self, details: dict) -> bool:
        if not self.user_symbols_list or details["id"] in self.user_symbols_list:
            if not self.ref_currency or details["quote"] == self.ref_currency:
                return True
        return False

    async def get_exchanges_mappings(self):
        for exchange in self.exchange_list:
            if exchange not in self.data["exchanges"]:
                self.data["exchanges"] = dict()
            exchange_object = get_exchange_object(exchange, async_mode=True)
            symbols = await exchange_object.load_markets()
            filtered_symbols = dict()
            for symbol, details in symbols.items():
                if await self.is_pair_in_scope(details):
                    filtered_symbols[symbol] = details
                    if details["id"] not in self.all_symbols:
                        self.all_symbols.append(details["id"])
            self.data["exchanges"][exchange] = dict(
                mapping=filtered_symbols, object=exchange_object
            )

    async def get_ws_uri(self) -> str:
        all_exchanges = list(self.data["exchanges"].keys())
        pair_str = ",".join(self.all_symbols)
        return f"{WS_URL}?exchange={','.join(all_exchanges)}?trades={pair_str}?book={pair_str}"

    async def handle_unavailable_server(self):
        for exchange in self.data["exchanges"]:
            await self.data["exchanges"][exchange]["object"].close()
        print("The Real Time Data service is down.")

    async def run_with_ws(self):
        uri = await self.get_ws_uri()
        try:
            async with websockets.connect(uri, ping_interval=None) as server_ws:
                while True:
                    try:
                        response = await server_ws.recv()
                        if response != "heartbeat":
                            symbols = self.data["exchanges"]["coinbase"]["mapping"]
                            exchange_object = self.data["exchanges"]["coinbase"][
                                "object"
                            ]
                            await self.daily_refresh(exchange_object, symbols)
                            await self.live_refresh(exchange_object, symbols, response)
                            if self.verbose:
                                self.print_scores(exchange_object.name.lower())
                    except (
                        websockets.ConnectionClosedError or asyncio.IncompleteReadError
                    ):
                        exchange_object.close()
                        await self.handle_unavailable_server()
                        break
                    await asyncio.sleep(0)
        except ConnectionRefusedError:
            await self.handle_unavailable_server()

    async def run_with_api(self):
        symbols = self.data["exchanges"]["coinbase"]["mapping"]
        exchange_object = self.data["exchanges"]["coinbase"]["object"]
        while True:
            await self.daily_refresh(exchange_object, symbols)
            await self.live_refresh(exchange_object, symbols)
            if self.verbose:
                self.print_scores(exchange_object.name.lower())

    async def run_screening(self):
        await self.get_exchanges_mappings()
        await self.run_with_ws()
        await self.run_with_api()

    async def run_client_websocket(self, client_ws):
        while True:
            exchange_name = "coinbase"  # TODO: to be updated
            if self.data["exchanges"][exchange_name].get("scores") is not None:
                ws_data = self.data["exchanges"][exchange_name]["scores"].to_json(
                    orient="records"
                )
                try:
                    await client_ws.send(ws_data)
                except (
                    websockets.exceptions.ConnectionClosedError
                    or websockets.exceptions.ConnectionClosedOK
                ):
                    await client_ws.close()
                    return
            await asyncio.sleep(1)


async def run_websocket():
    screener = Screener(
        exchange_list=["coinbase"],
        user_symbols_list=["BTC-USD", "ETH-USD"],
        verbose=True,
    )
    screening_task = asyncio.create_task(screener.run_screening())
    start_server = websockets.serve(screener.run_client_websocket, "localhost", 8795)
    await asyncio.gather(screening_task, start_server)


if __name__ == "__main__":
    asyncio.run(run_websocket())
