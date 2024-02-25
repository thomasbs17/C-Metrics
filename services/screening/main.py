import asyncio
import json
import os
import sys
import time

import ccxt.async_support as ccxt
import pandas as pd
import websockets
from indicators.technicals import FractalCandlestickPattern
import pandas_ta as ta
from datetime import datetime as dt

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from utils.helpers import get_exchange_object

WS_URL = "ws://localhost:8768"


async def handle_unavailable_server():
    print("The Real Time Data service is down.")


class ExchangeScreener:
    def __init__(self, verbose: bool, pairs: dict, exchange_object: ccxt.Exchange):
        self.verbose = verbose
        self.pairs = pairs
        self.exchange_name = exchange_object.name.lower()
        self.exchange_object = exchange_object
        self.clients = set()
        self.all_symbols = list()
        self.data = dict()

    async def add_technical_indicators(self, pair: str):
        if self.verbose:
            print(f"Computing technical indicators for {pair}")
        self.data[pair]["ohlcv"].ta.cores = 0
        CustomStrategy = ta.Strategy(
            name="Momo and Volatility",
            description="SMA 50,200, BBANDS, RSI, MACD and Volume SMA 20",
            ta=[
                {"kind": "sma", "length": 50},
                {"kind": "sma", "length": 200},
                {"kind": "bbands", "length": 20},
                {"kind": "rsi"},
                {"kind": "macd", "fast": 8, "slow": 21},
                {"kind": "sma", "close": "volume", "length": 20, "prefix": "VOLUME"},
            ],
        )
        try:
            self.data[pair]["ohlcv"].ta.strategy(CustomStrategy)
        except Exception as e:
            print(f'Could not compute all indicators for {pair}:\n \n {e}')

    async def get_pair_ohlcv(self, pair: str):
        if "ohlcv" not in self.data[pair]:
            ohlc_data = await self.exchange_object.fetch_ohlcv(
                symbol=pair, timeframe="1d", limit=300
            )
            if self.verbose:
                print(f"Downloading OHLCV data for {pair}")
            self.data[pair]["ohlcv"] = pd.DataFrame(
                data=ohlc_data,
                columns=["timestamp", "open", "high", "low", "close", "volume"],
            )
            if self.data[pair]["ohlcv"].empty:
                print(f"No OHLCV data for {pair}")

    async def live_refresh(self, raw_data: str = None):
        pair = await self.read_ws_message(raw_data)
        await self.get_scoring([pair])

    async def update_pair_ohlcv(self, pair: str, data: dict):
        trade = data["trades"]
        await self.get_pair_ohlcv(pair)
        ohlcv = self.data[pair]["ohlcv"]
        ohlcv["timestamp"] = ohlcv["timestamp"] / 1000
        trade_timestamp = dt.utcfromtimestamp(trade["timestamp"]).date()
        latest_ohlcv_timestamp = dt.utcfromtimestamp(ohlcv["timestamp"].iloc[-1]).date()
        if trade_timestamp > latest_ohlcv_timestamp:
            new_row = pd.DataFrame(
                [
                    [
                        trade["timestamp"],
                        trade["price"],
                        trade["price"],
                        trade["price"],
                        trade["price"],
                        trade["amount"],
                    ]
                ],
                columns=["timestamp", "open", "high", "low", "close", "volume"],
            )
            ohlcv = pd.concat([ohlcv, new_row])
        else:
            idx = ohlcv.index[len(ohlcv) - 1]
            ohlcv.loc[idx, "timestamp"] = time.time()
            ohlcv.loc[idx, "high"] = max(ohlcv.loc[idx, "high"], trade["price"])
            ohlcv.loc[idx, "low"] = min(ohlcv.loc[idx, "low"], trade["price"])
            ohlcv.loc[idx, "close"] = trade["price"]
            ohlcv.loc[idx, "volume"] += trade["amount"]
        self.data[pair]["ohlcv"] = ohlcv

    async def read_ws_message(self, raw_data: dict) -> str:
        data = json.loads(raw_data)
        for method in data:
            pair = data[method]["symbol"].replace("-", "/")
            if pair not in self.data:
                self.data[pair] = dict()
            if pair in self.pairs:
                if method == "trades":
                    await self.update_pair_ohlcv(pair, data)
                if method == "book":
                    self.data["pair"]["book"] = data[method][method]
            return pair

    async def get_pair_book(self, pair: str):
        if "book" not in self.data[pair]:
            try:
                self.data[pair]["book"] = await self.exchange_object.fetch_order_book(
                    symbol=pair, limit=100
                )
                if self.verbose:
                    print(f"Downloading Order Book data for {pair}")
            except Exception as e:
                print(f"Could not download order book for {pair}: \n {e}")

    def get_book_scoring(self, pair: str, depth: int = 50) -> float:
        data = dict()
        pair_book = self.data[pair]["book"]
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

    async def score_pair(self, pair: str) -> dict:
        if pair not in self.data:
            self.data[pair] = dict()
        await self.get_pair_ohlcv(pair)
        await self.get_pair_book(pair)
        if (
            self.data[pair].get("ohlcv") is not None
            and self.data[pair].get("book") is not None
        ):
            scoring = dict()
            await self.add_technical_indicators(pair)
            levels = FractalCandlestickPattern(self.data[pair]["ohlcv"]).run()
            scoring["close"] = self.data[pair]["ohlcv"]["close"].iloc[-1]
            scoring["rsi"] = (
                self.data[pair]["ohlcv"]["RSI_14"].iloc[-1]
                if "RSI_14" in self.data[pair]["ohlcv"].columns
                else None
            )
            scoring["bbl"] = (
                scoring["close"] / self.data[pair]["ohlcv"]["BBL_20_2.0"].iloc[-1]
                if "BBL_20_2.0" in self.data[pair]["ohlcv"].columns.tolist()
                else None
            )
            supports = [level for level in levels if level < scoring["close"]]
            resistances = [level for level in levels if level > scoring["close"]]
            scoring["next_support"] = float(max(supports)) if supports else None
            scoring["next_resistance"] = (
                float(min(resistances)) if resistances else None
            )
            scoring["potential_gain"] = (
                (scoring["next_resistance"] / scoring["next_support"]) - 1
                if supports and resistances
                else None
            )
            scoring["support_dist"] = (
                scoring["close"] / scoring["next_support"] if supports else None
            )
            scoring["book_score"] = self.get_book_scoring(pair)
            if scoring["support_dist"] and scoring["bbl"] and scoring["rsi"]:
                scoring["technicals_score"] = 1 / (
                    scoring["rsi"] * scoring["bbl"] * scoring["support_dist"]
                )
            else:
                scoring["technicals_score"] = 0
            scoring["pair"] = pair
            return scoring

    async def get_scoring(self, pairs_to_screen: list = None) -> pd.DataFrame:
        scores = self.data.get("scores", pd.DataFrame(columns=["pair"]))
        pairs_to_screen = pairs_to_screen if pairs_to_screen else self.pairs
        for pair in pairs_to_screen:
            scores = scores[scores["pair"] != pair]
            pair_score = await self.score_pair(pair)
            if pair_score:
                pair_score_df = pd.DataFrame([pair_score])
                if not pair_score_df.empty:
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
            self.data["scores"] = scores.sort_values(by="score", ascending=False)

    def print_scores(self, top_score_amount: int = 10):
        scores = self.data["scores"]
        if scores is not None:
            top_scores = scores.head(top_score_amount)
            print(top_scores.to_string())

    async def get_ws_uri(self) -> str:
        pair_str = ",".join(self.all_symbols)
        return f"{WS_URL}?exchange={self.exchange_name}?trades=BTC-USD?book={pair_str}"

    async def screen_exchange(self):
        uri = await self.get_ws_uri()
        await self.get_scoring()
        try:
            async with websockets.connect(uri, ping_interval=None) as server_ws:
                while True:
                    try:
                        response = await server_ws.recv()
                        if response != "heartbeat":
                            await self.live_refresh(response)
                            if self.verbose:
                                self.print_scores()
                    except (
                        websockets.ConnectionClosedError or asyncio.IncompleteReadError
                    ):
                        self.exchange_object.close()
                        await handle_unavailable_server()
                        break
                    await asyncio.sleep(0)
        except ConnectionRefusedError:
            await handle_unavailable_server()


class Screener:
    def __init__(
        self,
        exchange_list: list = None,
        ref_currency: str = "USD",
        verbose: bool = False,
        user_symbols_list: list = None,
    ):
        self.ref_currency = ref_currency
        self.verbose = verbose
        self.user_symbols_list = user_symbols_list
        self.exchange_list = exchange_list if exchange_list else ccxt.exchanges
        self.data = dict()
        self.all_symbols = list()

    async def is_pair_in_scope(self, details: dict) -> bool:
        if not self.user_symbols_list or details["id"] in self.user_symbols_list:
            if not self.ref_currency or details["quote"] == self.ref_currency:
                return True
        return False

    async def get_exchanges_mappings(self):
        for exchange in self.exchange_list:
            exchange_object = get_exchange_object(exchange, async_mode=True)
            symbols = await exchange_object.load_markets()
            filtered_symbols = dict()
            for symbol, details in symbols.items():
                if await self.is_pair_in_scope(details):
                    filtered_symbols[symbol] = details
                    if details["id"] not in self.all_symbols:
                        self.all_symbols.append(details["id"])
            self.data[exchange] = dict(mapping=filtered_symbols, object=exchange_object)

    async def run_screening(self):
        await self.get_exchanges_mappings()
        for exchange, details in self.data.items():
            self.screener = ExchangeScreener(
                self.verbose, details["mapping"], details["object"]
            )
            await self.screener.screen_exchange()

    async def run_client_websocket(self, client_ws):
        while True:
            if self.screener.data.get("scores") is not None:
                ws_data = self.screener.data["scores"].to_json(
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
    screener = Screener(exchange_list=["coinbase"], verbose=True)
    screening_task = asyncio.create_task(screener.run_screening())
    start_server = websockets.serve(screener.run_client_websocket, "localhost", 8795)
    await asyncio.gather(screening_task, start_server)


if __name__ == "__main__":
    asyncio.run(run_websocket())
