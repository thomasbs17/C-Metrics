import asyncio
import json
import math
import multiprocessing
from queue import Empty

import websockets
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
        self.clients = list()
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
        self.client_data_queue.put({method: data.to_dict(numeric_type=float)})

    async def book_callback(self, data: dict, _):
        await self._callback(method="book", data=data)

    async def trades_callback(self, data: dict, tmstmp: float):
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
            process.start()

    async def add_client(
        self,
        websocket: websockets.WebSocketServerProtocol,
        path: str,
    ):
        params = self.get_ws_parameters(path)
        print(
            f"New session: {websocket.id} with parameters: {params} (process: {self})"
        )
        session_id = str(websocket.id)
        clients_details = dict(ws=websocket, params=params, session_id=session_id)
        self.clients.append(clients_details)
        try:
            await websocket.wait_closed()
        finally:
            self.clients = [ws for ws in self.clients if ws["session_id"] != session_id]
            print(f"Session {session_id} ended")

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

    async def retrieve_queue_data(self) -> list:
        client_queue_data = list()
        while True:
            try:
                data = self.client_data_queue.get_nowait()
                client_queue_data.append(data)
            except Empty:
                return client_queue_data

    async def send_to_client(self):
        while True:
            queue_data = await self.retrieve_queue_data()
            for client in self.clients.copy():
                try:
                    if queue_data:
                        for record in queue_data:
                            for method, data in record.items():
                                if data["symbol"].lower() in client["params"][
                                    "methods"
                                ].get(method, []):
                                    await client["ws"].send(json.dumps(data))
                except websockets.ConnectionClosed:
                    pass
            await asyncio.sleep(0)

    async def run_clients_websocket(self):
        async with websockets.serve(self.add_client, self.host, self.port):
            await self.send_to_client()


if __name__ == "__main__":
    # To debug from CLI: wscat -c ws://localhost:8768?exchange=kraken?trades=btc-usd?book=btc-usd
    aggregator = MarketDataAggregator(exchanges=["KRAKEN"], pairs=["BTC-USD"])
    asyncio.run(aggregator.run_clients_websocket())
