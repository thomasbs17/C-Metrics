"""
Copyright (C) 2017-2023 Bryant Moscon - bmoscon@gmail.com

Please see the LICENSE file for the terms and conditions
associated with this software.
"""
import asyncio
from decimal import Decimal
import multiprocessing
import time

from cryptofeed import FeedHandler
from cryptofeed.defines import BID, ASK, L2_BOOK, TRADES
from cryptofeed.exchanges import Kraken, Bequant, Coinbase, Binance
from cryptofeed.exchanges import EXCHANGE_MAP
from cryptofeed.backends.redis import BookRedis, TradeRedis
from cryptofeed.backends.socket import BookSocket, TradeSocket
import redis


REDIS_CLIENT = redis.StrictRedis(host="localhost", port=6379, db=0)


async def periodic_cache_clear():
    while True:
        await asyncio.sleep(0.01)
        all_keys = REDIS_CLIENT.keys("*")
        if all_keys:
            print(f"Clearing cache...")
        for key in all_keys:
            value = REDIS_CLIENT.zrange(key, 0, -1, withscores=True)
            if len(value) > 1:
                # print(f'Clearing {key} cache...')
                last_rank = REDIS_CLIENT.zcard(key) - 1
                REDIS_CLIENT.zremrangebyrank(key, 0, last_rank - 1)


def run_process(exchange_object: object, symbols: list):
    # multiprocessing.current_process().daemon = False
    config = {
        "log": {"filename": "redis-demo.log", "level": "INFO"},
        "backend_multiprocessing": True,
    }
    f = FeedHandler()
    f.add_feed(
        exchange_object(
            symbols=symbols,
            channels=[L2_BOOK, TRADES],
            callbacks={
                # L2_BOOK: BookRedis(snapshots_only=True),
                # TRADES: TradeRedis(),
                TRADES: TradeSocket("tcp://127.0.0.1", port=5555),
                L2_BOOK: BookSocket("tcp://127.0.0.1", port=5555),
            },
            # config=config,
        )
    )
    f.run()
    # try:
        # loop = asyncio.get_event_loop()
        # loop.create_task(periodic_cache_clear())
        # f.run(start_loop=False)
        # loop.run_forever()
    # finally:
        # loop.close()


def get_all_pairs(exchange: object, ref_currency: str) -> list:
    pairs = exchange.symbols()
    non_premium_usd_pairs = [
        pair for pair in pairs if "PINDEX" not in pair and pair.endswith(ref_currency)
    ]
    return non_premium_usd_pairs


def main():
    # REDIS_CLIENT.flushall()
    # for exchange, exchange_object in EXCHANGE_MAP.items():
    exchange_object = Coinbase
    # ref_currency = "USDT"
    # all_pairs = get_all_pairs(exchange_object, ref_currency)
    all_pairs = ['BTC-USD']
    symbols_per_process = 20
    sublists = [
        all_pairs[i : i + symbols_per_process]
        for i in range(0, len(all_pairs), symbols_per_process)
    ]
    run_process(exchange_object, all_pairs)
    # with multiprocessing.Pool(processes=multiprocessing.cpu_count()) as pool:
    #     pool.starmap(run_process, [(exchange_object, symbols) for symbols in sublists]),


if __name__ == "__main__":
    main()
