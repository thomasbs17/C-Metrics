import asyncio
from decimal import Decimal
import json
from multiprocessing import Process
import socket
from time import sleep
import redis
import websockets


class DisplayLiveData:
    def __init__(self, broker: str, pair: str):
        self.redis_client = redis.StrictRedis(host="localhost", port=6379, db=0)
        self.broker = broker
        self.pair = pair
        self.latest_trade_timestamp = 0
        self.bid = 0
        self.ask = 0

    def retrieve_from_redis(self, channel: str, limit: int = -1) -> list:
        key = f"{channel}-{self.broker}-{self.pair}"
        value = self.redis_client.zrange(key, -1, limit, withscores=True)
        data = []
        if value:
            for record in value:
                data.append(json.loads(record[0].decode("utf-8")))
        return data

    def display_trades(self):
        trades = self.retrieve_from_redis(channel="trades")
        if trades:
            new_trade_timestamp = trades[0]["timestamp"]
            if new_trade_timestamp != self.latest_trade_timestamp:
                self.latest_trade_timestamp = new_trade_timestamp
                print(trades[0]["side"])
                print("Volume:", trades[0]["amount"])
                print("Price:", trades[0]["price"])
                print(f'${trades[0]["amount"] * trades[0]["price"]:,.2f}')
                print("____________________________________")

    def display_order_book(self):
        book = self.retrieve_from_redis(channel="book")
        if book:
            bids = list(book[0]["book"]["bid"].keys())
            asks = list(book[0]["book"]["ask"].keys())
            new_bid = bids[0]
            new_ask = asks[0]
            if self.bid != new_bid or self.ask != new_ask:
                self.bid = new_bid
                self.ask = new_ask
                print("Bid", self.bid)
                print("Ask", self.ask)
                print("____________________________________")

    def continuous_display(self):
        while True:
            self.display_trades()
            self.display_order_book()


async def reader(reader, _):
    bid = 0
    ask = 0
    while True:
        data = await reader.read(1024 * 640)
        message = data.decode()
        message = message.replace("}{", "},{")
        message = f"[{message}]"
        try:
            message = json.loads(message, parse_float=Decimal)
        except:
            message = []
        if message:
            data = message[0]["data"]
            # print(data['symbol'])
            if data["symbol"] == "BTC-USD":
                if message[0]["type"] == "trades":
                    print(
                        f'New trade: {data["side"]} {data["amount"]} @ {data["price"]}'
                    )
                else:
                    bids = list(data["book"]["bid"].keys())
                    asks = list(data["book"]["ask"].keys())
                    if bid != bids[0] or ask != asks[0]:
                        bid = bids[0]
                        ask = asks[0]
                        print(f"Bid: {bid} / Ask: {ask}")


async def main():
    server = await asyncio.start_server(reader, "127.0.0.1", 8080)

    await server.serve_forever()


# asyncio.run(main())
