import asyncio
import math
import multiprocessing
from queue import Empty
import websockets
from yapic import json

from cryptofeed import FeedHandler
from cryptofeed.defines import TRADES, L2_BOOK
from cryptofeed.exchanges import EXCHANGE_MAP


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
        self.client_queue = multiprocessing.Queue()
        self.client_data_queue = multiprocessing.Queue()
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
        try:
            queue_data = self.client_queue.get(block=False, timeout=1)
        except Empty:
            return
        if method in queue_data and data.symbol in queue_data[method]:
            self.client_data_queue.put(data.to_dict(numeric_type=float))

    async def book_callback(self, data: dict, tmstmp: float):
        await self._callback(method="book", data=data)

    async def trades_callback(self, data: dict, tmstmp: float):
        print(data)
        await self._callback(method="trades", data=data)

    def run_process(self, markets: dict):
        # https://stackoverflow.com/questions/3288595/multiprocessing-how-to-use-pool-map-on-a-function-defined-in-a-class
        multiprocessing.current_process().daemon = False
        f = FeedHandler(FEED_CONFIG)
        for exchange, exchange_pairs in markets.items():
            f.add_feed(
                EXCHANGE_MAP[exchange](
                    channels=[L2_BOOK, TRADES],
                    symbols=exchange_pairs,
                    callbacks={
                        L2_BOOK: self.book_callback,
                        TRADES: self.trades_callback,
                    },
                    config=FEED_CONFIG,
                )
            )
        f.run()

    def add_all_feeds(self):
        sub_markets = self.break_down_pairs_per_cpu()
        processes = list()
        for markets in sub_markets:
            process = multiprocessing.Process(target=self.run_process, args=(markets,))
            processes.append(process)
        for process in processes:
            process.start()
        # for process in processes:
        #     process.join()

    async def send_to_aggregator_process(
        self, websocket, path: str, session_id: str
    ) -> bool:
        try:
            if session_id not in self.clients:
                params = self.get_ws_parameters(path)
                self.clients[session_id] = params
                print(
                    f"New session: {websocket.id} with parameters: {params} (process: {self})"
                )
            self.client_queue.put(self.clients[session_id])
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

    async def send_to_client(self, websocket):
        try:
            queue_data = self.client_data_queue.get(block=False, timeout=1)
            await websocket.send(json.dumps(queue_data))
        except Empty:
            pass

    async def client_server(self, websocket, path: str):
        while True:
            try:
                await self.send_to_client(websocket)
                session_id = str(websocket.id)
                if not await self.send_to_aggregator_process(
                    websocket, path, session_id
                ):
                    print(
                        f"Failed connection attempt (invalid parameters): {session_id}"
                    )
                    self.clients.pop(session_id, None)
                    break
            except websockets.exceptions.ConnectionClosed:
                print(f"Session {session_id} ended")
                self.clients.pop(session_id, None)
                break

    def run_clients_websocket(self):
        start_server = websockets.serve(self.client_server, self.host, self.port)
        asyncio.get_event_loop().run_until_complete(start_server)
        asyncio.get_event_loop().run_forever()


if __name__ == "__main__":
    aggregator = MarketDataAggregator(exchanges=["KRAKEN"], ref_curreny="USD")
    aggregator.run_clients_websocket()
