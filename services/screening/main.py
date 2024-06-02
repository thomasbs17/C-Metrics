import asyncio
import os
import sys
import warnings

import aiohttp
import ccxt.async_support as ccxt
import pandas as pd
import pandas_ta as ta
import websockets
from indicators import technicals

warnings.filterwarnings("ignore")
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

    def add_technical_indicators(self, pair: str) -> tuple[pd.DataFrame, bool]:
        if self.verbose:
            LOG.info(f"Computing technical indicators for {pair}")
        ohlcv = self.data["ohlcv"][self.data["ohlcv"]["pair"] == pair]
        ohlcv.ta.cores = 0
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
            ohlcv.ta.strategy(CustomStrategy)
            is_scorable = True
        except Exception as e:
            LOG.warning(f"Could not compute all indicators for {pair}:\n \n {e}")
            is_scorable = False
        return ohlcv, is_scorable

    async def get_ohlcv(self):
        if self.verbose:
            LOG.info("Downloading OHLCV data")
        try:
            url = f"{helpers.BASE_API}/ohlc/?exchange=coinbase&timeframe=1d&full_history=y"
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as ohlc_data:
                    error_message = await ohlc_data.text() if not ohlc_data.ok else None
                    if not error_message:
                        ohlc_data = await ohlc_data.json()
                        self.data["ohlcv"] = pd.DataFrame(
                            data=ohlc_data,
                            columns=[
                                "timestamp",
                                "open",
                                "high",
                                "low",
                                "close",
                                "volume",
                                "pair",
                                "insert_tmstmp",
                            ],
                        )
        except Exception as e:
            error_message = e
        if error_message:
            LOG.warning(f"No OHLCV data | {error_message}")

    def technical_indicators_scoring(
        self, scoring: dict, pair: str
    ) -> tuple[dict, bool]:
        ohlcv, is_scorable = self.add_technical_indicators(pair)
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
            ohlcv = self.data["ohlcv"][self.data["ohlcv"]["pair"] == pair]
            ohlcv["usd_volume"] = ohlcv.apply(
                lambda x: x["volume"] * x["close"], axis=1
            )
            scoring["usd_volume"] = ohlcv["usd_volume"].sum()
            total_volume = ohlcv["volume"].sum()
            vbp = technicals.get_vbp(ohlcv)
            fractals = technicals.FractalCandlestickPattern(ohlcv).run()
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

    def score_pair(self, pair: str):
        if pair not in self.data:
            self.data[pair] = dict()
        if "ohlcv" in self.data:
            ohlcv = self.data["ohlcv"][self.data["ohlcv"]["pair"] == pair]
            last_update_tmstmp = self.data[pair].get("last_update_tmstmp")
            if not last_update_tmstmp or last_update_tmstmp < pd.to_datetime(
                ohlcv["insert_tmstmp"].max()
            ):
                self.scores = self.scores[self.scores["pair"] != pair]
                self.data[pair]["last_update_tmstmp"] = pd.Timestamp.now(tz="UTC")
                if not ohlcv.empty:
                    scoring = dict()
                    scoring, is_scorable = self.technical_indicators_scoring(
                        scoring, pair
                    )
                    scoring, is_scorable = self.vbp_based_scoring(
                        pair, scoring, is_scorable
                    )
                    scoring["available_data_length"] = len(ohlcv)
                    if is_scorable:
                        scoring["score"] = (
                            # scoring["risk_reward_ratio"]
                            # scoring["support_strength"]
                            +(1 - (scoring["rsi"] / 100))
                            + (1 - scoring["bbl"])
                            # + (1 - scoring["distance_to_support"])
                        )
                    else:
                        scoring["score"] = 0
                    scoring["pair"] = pair
                    pair_score_df = pd.DataFrame([scoring])
                    if not pair_score_df.empty:
                        self.scores = pd.concat([self.scores, pair_score_df])

    async def get_scoring(self):
        for pair in self.pairs:
            self.score_pair(pair)
        if not self.scores.empty:
            self.scores["score"] = self.scores.apply(
                lambda x: x["score"]
                + (x["usd_volume"] / self.scores["usd_volume"].max()),
                axis=1,
            )
            self.scores.sort_values(by="score", ascending=False, inplace=True)

    async def screen_exchange(self):
        while True:
            self.updated = True
            await self.get_ohlcv()
            await self.get_scoring()
            await asyncio.sleep(0)


class Screener:
    def __init__(
        self,
        exchange_list: list = None,
        ref_currency: str = "USDC",
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
        for details in self.data.values():
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
