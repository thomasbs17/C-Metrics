import asyncio
import json
import math
import multiprocessing
import os
import sys
from datetime import datetime as dt
from queue import Empty

import websockets
from cryptofeed import FeedHandler
from cryptofeed.defines import TRADES, L2_BOOK
from cryptofeed.exchanges import EXCHANGE_MAP
from dotenv import load_dotenv

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from utils import helpers


BASE_CONFIG = {
    "log": {"filename": "demo.log", "level": "DEBUG", "disabled": True},
    "backend_multiprocessing": True,
}
load_dotenv(verbose=True)

WS_PORT = 8768


class MarketDataAggregator:
    def __init__(
        self,
        exchanges: list = None,
        pairs: list = None,
        ref_currency: str = None,
        max_cpu_amount: int = None,
    ):
        self.cpu_amount = (
            max_cpu_amount if max_cpu_amount else multiprocessing.cpu_count() - 1
        )
        self.exchanges = (
            {exchange: EXCHANGE_MAP[exchange] for exchange in exchanges}
            if exchanges
            else EXCHANGE_MAP
        )
        self.pairs = pairs
        self.ref_currency = ref_currency
        self.markets = self.get_markets()
        self.clients = list()
        self.client_queue = multiprocessing.Queue()
        self.client_data_queue = multiprocessing.Queue()
        self.add_all_feeds()

    @staticmethod
    def get_feed_config(exchange_name: str) -> dict:
        feed_config = BASE_CONFIG.copy()
        keys = helpers.get_api_keys(exchange_name.lower(), websocket=True)
        if keys:
            feed_config[exchange_name.lower()] = keys
        return feed_config

    def get_markets(self) -> dict:
        markets = dict()
        for exchange_name, exchange_object in self.exchanges.items():
            feed_config = self.get_feed_config(exchange_name)
            pairs = exchange_object.symbols(feed_config)
            filtered_pairs = list()
            for pair in pairs:
                if not self.pairs or pair in self.pairs:
                    _, quote = pair.split("-")
                    if "PINDEX" not in pair and (
                        not self.ref_currency or quote == self.ref_currency
                    ):
                        filtered_pairs.append(pair)
            if filtered_pairs:
                markets[exchange_name] = filtered_pairs
        return markets

    def break_down_pairs_per_cpu(self) -> list:
        total_amount_of_pairs = 0
        for pairs in self.markets.values():
            total_amount_of_pairs += len(pairs)
        symbols_per_process = math.ceil(total_amount_of_pairs / self.cpu_amount)
        current_sub_dict = dict()
        sub_lists = list()
        for exchange, exchange_pairs in self.markets.items():
            for pair in exchange_pairs:
                if exchange not in current_sub_dict:
                    current_sub_dict[exchange] = list()
                total_amount_of_pairs = sum(
                    len(values) for values in current_sub_dict.values()
                )
                if total_amount_of_pairs <= symbols_per_process:
                    current_sub_dict[exchange].append(pair)
                else:
                    sub_lists.append(current_sub_dict)
                    current_sub_dict = dict()
        sub_lists.append(current_sub_dict)
        return sub_lists

    async def _callback(self, method: str, data):
        try:
            queue_data = self.client_queue.get(block=False, timeout=0.01)
        except Empty:
            return
        self.client_queue.put(queue_data)
        self.client_data_queue.put({method: data.to_dict(numeric_type=float)})

    async def book_callback(self, data, tmstmp: float):
        await self._callback(method="book", data=data)

    async def trades_callback(self, data, tmstmp: float):
        await self._callback(method="trades", data=data)

    def run_process(self, markets: dict):
        # https://stackoverflow.com/questions/3288595/multiprocessing-how-to-use-pool-map-on-a-function-defined-in-a-class
        multiprocessing.current_process().daemon = False
        f = FeedHandler()
        for exchange, exchange_pairs in markets.items():
            feed_config = self.get_feed_config(exchange)
            f.add_feed(
                EXCHANGE_MAP[exchange](
                    channels=[L2_BOOK, TRADES],
                    symbols=exchange_pairs,
                    callbacks={
                        L2_BOOK: self.book_callback,
                        TRADES: self.trades_callback,
                    },
                    config=feed_config,
                )
            )
        f.run()

    def add_all_feeds(self):
        sub_markets = self.break_down_pairs_per_cpu()
        processes = list()
        for markets in sub_markets:
            process = multiprocessing.Process(target=self.run_process, args=(markets,))
            processes.append(process)
            process.start()

    async def send_to_aggregator_process(
        self, websocket, session_id: str, params: dict
    ):
        if session_id not in self.clients:
            self.clients.append(session_id)
            print(f"New session: {websocket.id} with parameters: {params}")
            self.client_queue.put(session_id)

    @staticmethod
    def get_ws_parameters(path: str) -> dict:
        params = path[1:].split("?")
        formatted_param = dict(methods=dict())
        validation = dict(exchange=False, method=False)
        for param in params:
            if param:
                param_name, param_value = param.split("=")
                param_value = param_value.split(",")
                if param_name == "exchange":
                    validation["exchange"] = True
                    formatted_param[param_name] = param_value
                elif param_name in ("book", "trades") and param_value:
                    formatted_param["methods"][param_name] = param_value
                    validation["method"] = True
        is_validated = all(value for value in validation.values())
        if is_validated:
            return formatted_param

    async def send_to_client(self, websocket, params: dict):
        while True:
            try:
                queue_data = self.client_data_queue.get(block=False, timeout=1)
                for method, details in queue_data.items():
                    if (
                        method in params["methods"]
                        and params["exchange"][0].upper() == details["exchange"]
                        and details["symbol"].upper()
                        in [pair.upper() for pair in params["methods"][method]]
                    ):
                        await websocket.send(json.dumps(queue_data, default=str))
            except Empty:
                return

    async def empty_queue(self):
        while True:
            try:
                self.client_queue.get(block=False, timeout=0.01)
            except Empty:
                break

    async def client_server(self, websocket, path: str):
        session_id = str(websocket.id)
        params = self.get_ws_parameters(path)
        heartbeat_tmstmp = dt.now()
        if not params:
            print(f"Failed connection attempt (invalid parameters): {session_id}")
            await websocket.send("Invalid parameters")
            await websocket.close()
        else:
            while True:
                await self.send_to_aggregator_process(websocket, session_id, params)
                try:
                    await self.send_to_client(websocket, params)
                    if (dt.now() - heartbeat_tmstmp).seconds > 1:
                        await websocket.send("heartbeat")
                        heartbeat_tmstmp = dt.now()
                except websockets.exceptions.ConnectionClosed:
                    print(f"Session {session_id} ended")
                    self.clients.remove(session_id)
                    await self.empty_queue()
                    await websocket.close()
                    return
                await asyncio.sleep(0)

    def run_clients_websocket(self):
        start_server = websockets.serve(self.client_server, helpers.HOST, WS_PORT)
        asyncio.get_event_loop().run_until_complete(start_server)
        asyncio.get_event_loop().run_forever()


if __name__ == "__main__":
    aggregator = MarketDataAggregator(
        exchanges=["COINBASE"], pairs=["BTC-USD", "ETH-USD"]
    )
    aggregator.run_clients_websocket()
