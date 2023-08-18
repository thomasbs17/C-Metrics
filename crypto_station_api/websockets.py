import asyncio
from decimal import Decimal
import json
from datetime import datetime as dt
from cryptofeed import FeedHandler
from cryptofeed.defines import (
    L2_BOOK,
)
from cryptofeed import exchanges
import websockets

# TODO: this is only meant to be used by one client for now


class RealTimeMarketData:
    def __init__(self):
        self.clients = set()
        self.exchange = exchanges.Kraken
        self.pair = "BTC-USD"
        self.config = {
            "log": {"filename": "demo.log", "level": "DEBUG", "disabled": False}
        }
        self.f = FeedHandler(config=self.config)
        self.add_feed(pair=self.pair, exchange=self.exchange)
        self.data = dict(bids=[], asks=[])
        self.last_emission_tmstmp = dt.now()

    def add_feed(self, pair: str, exchange):
        self.f.add_feed(
            exchange(
                config="config.yaml",
                checksum_validation=True,
                subscription={
                    L2_BOOK: [pair],
                    # TRADES: ["SOL-USD"],
                },
                callbacks={
                    L2_BOOK: self.book,
                    # TRADES: trade,
                },
            )
        )

    async def send_to_clients(self, *args):
        batching_condition = (
            True if (dt.now() - self.last_emission_tmstmp).seconds > 0 else False
        )
        if self.clients and batching_condition and len(self.data['asks']) > 0:
            print(f"Bid: {self.data['bids'][0]} / Ask: {self.data['asks'][0]}")
            self.last_emission_tmstmp = dt.now()
            await asyncio.wait(
                [client.send(json.dumps(self.data)) for client in self.clients]
            )

    def get_paramters(self, websocket):
        exchange = None
        pair = None
        indexes = []
        i = 0
        path = websocket.path
        while True:
            path = path[i + 1 :]
            i = path.find("=")
            if i == -1:
                break
            else:
                indexes.append(i)
        if len(indexes) != 0:
            exchange = websocket.path[indexes[0] + 2 : indexes[0] + indexes[1] - 3]
            pair = path
        return exchange, pair

    def handle_parameters_change(self, websocket):
        exchange, pair = self.get_paramters(websocket)
        if (pair and exchange) and (pair != self.pair or exchange != self.exchange):
            pair = pair.replace("/", "-")
            exchange = exchange.capitalize()
            self.pair = pair
            self.exchange = exchange
            self.data = dict(bids=[], asks=[])
            self.f = FeedHandler(config=self.config)
            self.clients = set()
            try:
                for feed in self.f.feeds:
                    feed.shutdown()
                    feed.close()
                self.f.feeds = []
                self.add_feed(pair=pair, exchange=getattr(exchanges, exchange))
                loop = asyncio.get_event_loop()
                self.f.feeds[0].start(loop)
                print(f"Opened new websocket for {pair} on {exchange}")
            except Exception as e:
                self.data = dict(bids=[], asks=[])
                print(f"Could not open websocket: {e}")

    async def server(self, websocket):
        self.handle_parameters_change(websocket)
        self.clients.add(websocket)
        try:
            await asyncio.gather(
                websocket.recv(),
                self.send_to_clients(),
            )
        finally:
            pass

    async def book(self, book, *args):
        if book.symbol == self.pair:
            bids = [
                [float(price), float(volume)]
                for price, volume in book.book.bids.to_dict().items()
            ]
            asks = [
                [float(price), float(volume)]
                for price, volume in book.book.asks.to_dict().items()
            ]
            self.data = dict(bids=bids, asks=asks)
            await self.send_to_clients({"type": "book", "data": self.data})


    def run(self):
        asyncio.get_event_loop().run_until_complete(
            websockets.serve(self.server, "localhost", 8765)
        )
        self.f.run()


if __name__ == "__main__":
    rtmd = RealTimeMarketData()
    rtmd.run()
