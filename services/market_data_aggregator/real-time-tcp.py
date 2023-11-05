import asyncio
import datetime
from decimal import Decimal
import math
import multiprocessing
import random
import time
import websockets
import pathos
from yapic import json

from cryptofeed import FeedHandler
from cryptofeed.backends.socket import TradeSocket, BookSocket
from cryptofeed.defines import TRADES, L2_BOOK
from cryptofeed.exchanges import Coinbase, Kraken, Binance, EXCHANGE_MAP

from test_read_live import reader

multiprocessing.set_start_method("fork")

FEED_CONFIG = {
    "log": {"filename": "demo.log", "level": "DEBUG", "disabled": True},
    "backend_multiprocessing": True,
}


class MarketDataAggregator:
    host = "localhost"
    port = 8768

    def __init__(
        self,
        exchanges: list = None,
        pairs: list = None,
        ref_curreny: str = None,
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
        self.ref_currency = ref_curreny
        self.markets = self.get_markets()
        self.clients = dict()
        self.add_all_feeds()

    def get_markets(self) -> dict:
        markets = dict()
        for exchange_name, exchange_object in self.exchanges.items():
            pairs = exchange_object.symbols()
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
        if self.clients:
            async for client_subsriptions in self.clients.values():
                if method in client_subsriptions["parameters"]:
                    if data["symbol"] in client_subsriptions["parameters"][method]:
                        formatted_data = data.to_dict(numeric_type=float)
                        await client_subsriptions["parameters"].send(
                            formatted_data["book"]
                            if method == "book"
                            else formatted_data
                        )

    async def book_callback(self, data: dict, tmstmp: float):
        # print(f"Book process: {self}")
        await self._callback(method="book", data=data)

    async def trades_callback(self, data: dict, tmstmp: float):
        # print(f"Trades process: {self}")
        await self._callback(method="trades", data=data)

    def run_process(self, markets: dict):
        # https://stackoverflow.com/questions/3288595/multiprocessing-how-to-use-pool-map-on-a-function-defined-in-a-class
        multiprocessing.current_process().daemon = False
        f = FeedHandler(FEED_CONFIG)
        # host = "tcp://127.0.0.1"
        # port = 8080
        for exchange, exchange_pairs in markets.items():
            f.add_feed(
                EXCHANGE_MAP[exchange](
                    channels=[L2_BOOK, TRADES],
                    symbols=exchange_pairs,
                    callbacks={
                        # L2_BOOK: BookSocket(host, port=port),
                        TRADES: TradeSocket(f"tcp://{self.host}", port=self.port),
                    },
                    config=FEED_CONFIG,
                )
            )
        f.run()

    def add_all_feeds(self):
        sub_markets = self.break_down_pairs_per_cpu()
        processes = list()
        for markets in sub_markets[:1]:
            process = multiprocessing.Process(target=self.run_process, args=(markets,))
            processes.append(process)
        for process in processes:
            process.start()
        # for process in processes:
        #     process.join()

    async def add_client(self, websocket, path: str, session_id: str) -> bool:
        try:
            params = self.get_ws_parameters(path)
            self.clients[session_id] = dict(websocket=websocket, parameters=params)
            print(
                f"New session: {websocket.id} with parameters: {params} (process: {self})"
            )
            return True
        except ValueError:
            if session_id in self.clients:
                self.clients.pop(session_id, None)
            await websocket.send("Invalid parameters")
        return False

    @staticmethod
    def get_ws_parameters(path: str) -> dict:
        params = path[1:].split("?")
        formatted_param = dict()
        for param in params:
            param_name, param_value = param.split("=")
            param_value = param_value.split(",")
            formatted_param[param_name] = param_value
        return formatted_param

    async def data_aggregation_websocket(self, reader, writer):
        while True:
            data = await reader.read(1024 * 640)
            message = data.decode()
            # if multiple messages are received back to back,
            # need to make sure they are formatted as if in an array
            message = message.replace("}{", "},{")
            message = f"[{message}]"
            message = json.loads(message, parse_float=Decimal)
            addr = writer.get_extra_info("peername")
            print(f"Received {message!r} from {addr!r}")

    async def client_websocket(self, websocket, path):
        while True:
            try:
                session_id = str(websocket.id)
                if session_id not in self.clients:
                    if not await self.add_client(websocket, path, session_id):
                        break
                await websocket.send("health: ok")
                await asyncio.sleep(1)
            except:
                print(f"Session {session_id} ended")
                self.clients.pop(session_id, None)
                break

    async def run_data_aggregation_websocket(self):
        server = await asyncio.start_server(
            self.data_aggregation_websocket, self.host, self.port
        )
        await server.serve_forever()

    def _run_clients_websocket(self):
        start_server = websockets.serve(self.client_websocket, self.host, 8080)
        asyncio.get_event_loop().run_until_complete(start_server)
        asyncio.get_event_loop().run_forever()

    def run_clients_websocket(self):
        multiprocessing.Process(target=self._run_clients_websocket).start()


if __name__ == "__main__":
    aggregator = MarketDataAggregator(exchanges=["KRAKEN"], pairs=["BTC-USD"])
    aggregator.run_clients_websocket()
    asyncio.run(aggregator.run_data_aggregation_websocket())
