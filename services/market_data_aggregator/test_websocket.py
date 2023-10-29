import asyncio
from decimal import Decimal
import math
from multiprocessing import Process
import multiprocessing
import time
import websockets

from yapic import json

from cryptofeed import FeedHandler
from cryptofeed.backends.socket import TradeSocket, BookSocket
from cryptofeed.defines import TRADES, L2_BOOK
from cryptofeed.exchanges import Coinbase, Kraken, Binance

from test_read_live import reader

ADDRESS = "tcp://127.0.0.1"
PORT = 8080

URI = "ws://127.0.0.1:8000/"


def get_all_pairs(exchange: object, ref_currency: str) -> list:
    pairs = exchange.symbols()
    non_premium_usd_pairs = [
        pair for pair in pairs if "PINDEX" not in pair and pair.endswith(ref_currency)
    ]
    return non_premium_usd_pairs


def run_process(exchange: object, symbols: list):
    multiprocessing.current_process().daemon = False
    config = {
        "log": {"filename": "redis-demo.log", "level": "INFO"},
        "backend_multiprocessing": True,
    }
    f = FeedHandler(config)
    f.add_feed(
        exchange(
            channels=[L2_BOOK, TRADES],
            symbols=symbols,
            callbacks={
                L2_BOOK: BookSocket(ADDRESS, port=PORT, snapshots_only=True),
                TRADES: TradeSocket(ADDRESS, port=PORT),
            },
            config=config,
        )
    )

    f.run()


def run_all_process():
    exchange = Kraken
    ref_currency = "USD"
    cpu_amount = multiprocessing.cpu_count() - 2
    symbols = get_all_pairs(exchange, ref_currency)
    symbols_per_process = math.ceil(len(symbols) / cpu_amount)
    sublists = [
        symbols[i : i + symbols_per_process]
        for i in range(0, len(symbols), symbols_per_process)
    ]
    # sublists = [["BTC-USDT"]]
    with multiprocessing.Pool(processes=cpu_amount) as pool:
        pool.starmap(run_process, [(exchange, symbols) for symbols in sublists]),


async def main():
    server = await asyncio.start_server(reader, "127.0.0.1", 8080)
    await server.serve_forever()


if __name__ == "__main__":
    p = Process(target=run_all_process)
    p.start()
    asyncio.run(main())
