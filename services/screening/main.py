import asyncio
import json
import os
import sys
import time
from datetime import datetime as dt

import ccxt.async_support as ccxt
import pandas as pd
import pandas_ta as ta
import requests
import websockets
from indicators import technicals

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from utils import helpers

WS_PORT = 8768
LOG = helpers.get_logger("screening_service")


class ExchangeScreener:
    def __init__(
        self,
        verbose: bool,
        pairs: dict,
        exchange_object: ccxt.Exchange,
        all_symbols: list,
    ):
        self.verbose = verbose
        self.pairs = pairs
        self.exchange_name = exchange_object.name.lower()
        self.exchange_object = exchange_object
        self.clients = set()
        self.all_symbols = all_symbols
        self.data = dict()
        self.scores = pd.DataFrame(columns=["pair"])
        self.updated = True

    async def load_all_data(self):
        # tasks = list()
        for pair in self.pairs:
            self.get_pair_ohlcv(pair)
            # tasks += [self.get_pair_ohlcv(pair)] #self.get_pair_book(pair)
        # await asyncio.gather(*tasks)

    async def add_technical_indicators(self, pair: str) -> bool:
        if self.verbose:
            LOG.info(f"Computing technical indicators for {pair}")
        self.data[pair]["ohlcv"].ta.cores = 0
        CustomStrategy = ta.Strategy(
            name="Momo and Volatility",
            description="SMA 50,200, BBANDS, RSI, MACD and Volume SMA 20",
            ta=[
                {"kind": "bbands", "length": 20},
                {"kind": "rsi"},
                {"kind": "macd", "fast": 8, "slow": 21},
            ],
        )
        try:
            self.data[pair]["ohlcv"].ta.strategy(CustomStrategy)
            return True
        except Exception as e:
            LOG.warning(f"Could not compute all indicators for {pair}:\n \n {e}")
            return False

    async def get_pair_book(self, pair: str):
        if self.verbose:
            LOG.info(f"Downloading Book data for {pair}")
        if pair not in self.data:
            self.data[pair] = dict()
        book_data = requests.get(
            url=f"{helpers.BASE_API}/order_book/?exchange=coinbase&pair={pair}&limit=100"
        )
        if book_data.status_code == 200:
            self.data[pair]["book"] = book_data.json()
        else:
            LOG.warning(f"No Book data for {pair}")

    @helpers.call_with_retries
    def get_pair_ohlcv(self, pair: str):
        if self.verbose:
            LOG.info(f"Downloading OHLCV data for {pair}")
        if pair not in self.data:
            self.data[pair] = dict()
        ohlc_data = requests.get(
            url=f"{helpers.BASE_API}/ohlc/?exchange=coinbase&pair={pair}&timeframe=1d&full_history=n"
        )
        if ohlc_data.status_code == 200:
            self.data[pair]["ohlcv"] = pd.DataFrame(
                data=ohlc_data.json(),
                columns=["timestamp", "open", "high", "low", "close", "volume"],
            )
        else:
            LOG.warning(f"No OHLCV data for {pair}")

    async def live_refresh(self, raw_data: bytes = None):
        self.updated = True
        pair = await self.read_ws_message(raw_data)
        await self.get_scoring([pair])

    async def update_pair_ohlcv(self, pair: str, data: dict):
        trade = data["trades"]
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

    async def read_ws_message(self, raw_data: bytes) -> str:
        data = json.loads(raw_data)
        for method in data:
            pair = data[method]["symbol"].replace("-", "/")
            if pair in self.pairs:
                if method == "trades":
                    await self.update_pair_ohlcv(pair, data)
                if method == "book":
                    self.data[pair]["book"] = data[method][method]
            return pair

    def get_book_scoring(self, pair: str, scoring: dict) -> dict:
        data = dict()
        pair_book = self.data[pair].get("book")
        if not pair_book:
            return dict(book_imbalance=None, spread=None)
        for side in ("bid", "ask"):
            raw_side = side if side in pair_book else side + "s"
            if isinstance(pair_book[raw_side], list):
                df = pd.DataFrame(pair_book[raw_side], columns=["price", "volume"])
                df.set_index("price", inplace=True)
            else:
                df = pd.DataFrame.from_dict(
                    pair_book[raw_side], orient="index", columns=["volume"]
                )
            mask = (
                df.index <= scoring["next_resistance"]
                if side == "ask"
                else df.index >= scoring["next_support"]
            )
            df = df[mask]
            if df.empty:
                return dict(book_imbalance=None, spread=None)
            data[side] = df
        spread = (float(data["ask"].index[0]) / float(data["bid"].index[0])) - 1
        book_imbalance = (data["bid"]["volume"].sum() / data["ask"]["volume"].sum()) - 1
        return dict(book_imbalance=book_imbalance, spread=spread)

    def technical_indicators_scoring(
        self, scoring: dict, pair: str, is_scorable: bool
    ) -> tuple[dict, bool]:
        ohlcv = self.data[pair]["ohlcv"]
        if not ohlcv.empty:
            scoring["close"] = ohlcv["close"].iloc[-1]
            scoring["24h_change"] = scoring["close"] / ohlcv["open"].iloc[-1] - 1
        else:
            scoring["close"] = None
            scoring["24h_change"] = None
            is_scorable = False
        if "RSI_14" in ohlcv.columns and is_scorable:
            rsi = ohlcv["RSI_14"].iloc[-1]
            scoring["rsi"] = int(rsi) if pd.notna(rsi) else None
        else:
            is_scorable = False
            scoring["rsi"] = None
        if "BBL_20_2.0" in ohlcv.columns.tolist() and is_scorable:
            bbl = ohlcv["BBL_20_2.0"].iloc[-1]
            scoring["bbl"] = (scoring["close"] / bbl) - 1 if pd.notna(bbl) else None
        else:
            is_scorable = False
            scoring["bbl"] = None
        return scoring, is_scorable

    def vbp_based_scoring(
        self, pair: str, scoring: dict, is_scorable: bool
    ) -> tuple[dict, bool]:
        if is_scorable:
            ohlcv = self.data[pair]["ohlcv"]
            ohlcv["usd_volume"] = ohlcv.apply(
                lambda x: x["volume"] * x["close"], axis=1
            )
            scoring["usd_volume"] = ohlcv["usd_volume"].sum()
            total_volume = ohlcv["volume"].sum()
            vbp = technicals.get_vbp(ohlcv)
            fractals = technicals.FractalCandlestickPattern(
                self.data[pair]["ohlcv"]
            ).run()
            fractal_resistances = sorted(
                [fractal for fractal in fractals if fractal > scoring["close"]]
            )
            supports = vbp[vbp["level_type"] == "support"].reset_index(drop=True)
            resistances = vbp[vbp["level_type"] == "resistance"].reset_index(drop=True)
            if len(supports) < 2 or resistances.empty or not fractal_resistances:
                is_scorable = False
            scoring["next_support"] = supports.loc[0, "close"] if is_scorable else None
            scoring["support_strength"] = (
                supports.loc[0, "volume"] / total_volume if is_scorable else None
            )
            scoring["next_resistance"] = (
                min(resistances.loc[0, "close"], fractal_resistances[0])
                if is_scorable
                else None
            )
            stop_loss_df = (
                supports[supports["close"] < scoring["next_support"]].reset_index(
                    drop=True
                )
                if is_scorable
                else pd.DataFrame()
            )
            if stop_loss_df.empty:
                is_scorable = False
            scoring["stop_loss"] = (
                stop_loss_df.iloc[0]["close"] if is_scorable else None
            )
            scoring["supports"] = (
                [scoring["next_support"], scoring["stop_loss"]] if is_scorable else None
            )
            scoring["resistances"] = (
                [scoring["next_resistance"]] if is_scorable else None
            )
            scoring["upside"] = (
                scoring["next_resistance"] / scoring["next_support"] - 1
                if is_scorable
                else None
            )
            scoring["downside"] = (
                scoring["next_support"] / scoring["stop_loss"] - 1
                if is_scorable
                else None
            )
            scoring["risk_reward_ratio"] = (
                scoring["upside"] / scoring["downside"] - 1 if is_scorable else None
            )
            scoring["distance_to_support"] = (
                scoring["close"] / scoring["next_support"] - 1 if is_scorable else None
            )
            scoring["distance_to_resistance"] = (
                scoring["next_resistance"] / scoring["close"] - 1
                if is_scorable
                else None
            )
        return scoring, is_scorable

    async def score_pair(self, pair: str):
        self.scores = self.scores[self.scores["pair"] != pair]
        if pair not in self.data:
            self.data[pair] = dict()
        ohlcv = self.data[pair].get("ohlcv")
        if ohlcv is not None:
            scoring = dict()
            is_scorable = await self.add_technical_indicators(pair)
            scoring, is_scorable = self.technical_indicators_scoring(
                scoring, pair, is_scorable
            )
            scoring, is_scorable = self.vbp_based_scoring(pair, scoring, is_scorable)
            if is_scorable:
                # book_score_details = self.get_book_scoring(pair, scoring)
                scoring = {**scoring}  # **book_score_details
                scoring["score"] = (
                    # scoring["risk_reward_ratio"]
                    scoring["support_strength"]
                    + (1 - (scoring["rsi"] / 100))
                    + (1 - scoring["bbl"])
                    # + (1 - scoring["distance_to_support"])
                    + (len(ohlcv) / 300)
                )
            else:
                scoring["score"] = 0
            scoring["pair"] = pair
            pair_score_df = pd.DataFrame([scoring])
            if not pair_score_df.empty:
                self.scores = pd.concat([self.scores, pair_score_df])

    async def get_scoring(self, pairs_to_screen: list = None):
        pairs_to_screen = pairs_to_screen if pairs_to_screen else self.pairs
        tasks = [self.score_pair(pair) for pair in pairs_to_screen]
        await asyncio.gather(*tasks)
        if not self.scores.empty:
            self.scores["score"] = self.scores.apply(
                lambda x: x["score"]
                + (x["usd_volume"] / self.scores["usd_volume"].max()),
                axis=1,
            )
            self.scores.sort_values(by="score", ascending=False, inplace=True)

    def log_scores(self, top_score_amount: int = 10):
        if self.scores is not None:
            top_scores = self.scores.head(top_score_amount)
            LOG.info(top_scores.to_string())

    async def get_ws_uri(self) -> str:
        pair_str = ",".join(self.all_symbols)
        return f"{helpers.BASE_WS}{WS_PORT}?exchange={self.exchange_name}?trades={pair_str}?book={pair_str}"

    async def handle_unavailable_server(self):
        LOG.error("The Real Time Data service is down.")
        while True:
            self.updated = True
            await self.load_all_data()
            await self.get_scoring()
            await asyncio.sleep(0)

    async def screen_exchange(self):
        uri = await self.get_ws_uri()
        await self.load_all_data()
        await self.get_scoring()
        try:
            async with websockets.connect(uri, ping_interval=None) as server_ws:
                while True:
                    try:
                        response = await server_ws.recv()
                        if response != "heartbeat":
                            await self.live_refresh(response)
                            if self.verbose:
                                self.log_scores()
                    except (
                        websockets.ConnectionClosedError or asyncio.IncompleteReadError
                    ):
                        await self.exchange_object.close()
                        await self.handle_unavailable_server()
                        break
                    await asyncio.sleep(0)
        except ConnectionRefusedError:
            await self.handle_unavailable_server()


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
            exchange_object = helpers.get_exchange_object(exchange, async_mode=True)
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
                self.verbose, details["mapping"], details["object"], self.all_symbols
            )
            await self.screener.screen_exchange()

    async def safe_send_to_clients(self, client_ws) -> bool:
        self.screener.updated = False
        ws_data = self.screener.scores.to_json(orient="records")
        try:
            await client_ws.send(ws_data)
            return True
        except Exception as e:
            LOG.info(f"Session ID {client_ws.id} ended: \n {e}")
            await client_ws.close()
            return False

    async def run_client_websocket(self, client_ws):
        self.screener.updated = True
        LOG.info(
            f"New client connected to screening service - session ID: {client_ws.id}"
        )
        client_is_connected = True
        if not self.screener.scores.empty:
            client_is_connected = await self.safe_send_to_clients(client_ws)
        while True:
            if not self.screener.scores.empty and self.screener.updated:
                client_is_connected = await self.safe_send_to_clients(client_ws)
            if not client_is_connected:
                break
            await asyncio.sleep(0)


async def run_websocket():
    screener = Screener(exchange_list=["coinbase"], verbose=True)
    screening_task = asyncio.create_task(screener.run_screening())
    start_server = websockets.serve(screener.run_client_websocket, "localhost", 8795)
    await asyncio.gather(screening_task, start_server)


if __name__ == "__main__":
    asyncio.run(run_websocket())
