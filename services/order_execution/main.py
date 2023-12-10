import asyncio
from datetime import datetime
import json
import os
from pathlib import Path
import threading

import msgpack
import pandas as pd
import psycopg2
import redis
from dotenv import load_dotenv
import requests
import sqlalchemy as sql

BASE_API_URL = "http://127.0.0.1:8000/ohlc"
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_PATH = BASE_DIR / ".env"
load_dotenv(ENV_PATH, verbose=True)


def get_db_connection() -> (psycopg2, sql.Engine):
    user = os.getenv("DB_USER")
    pwd = os.getenv("POSTGRES_PASSWORD")
    db_name = os.getenv("DB_NAME")
    host = os.getenv("DB_HOST")
    port = os.getenv("DB_PORT")
    dsn = f"postgresql://{user}:{pwd}@{host}:{port}/{db_name}"
    return psycopg2.connect(dsn), sql.create_engine(dsn)


class OnStartChecker:
    def __init__(self, open_orders_df: pd.DataFrame, db: psycopg2, engine: sql.Engine):
        self.open_orders_df = open_orders_df
        self.data = dict()
        self.filled_orders = dict()
        self.db = db
        self.engine = engine

    def get_ohlcv(self, order: pd.Series) -> pd.DataFrame:
        if order["asset_id"] not in self.data:
            url = f"{BASE_API_URL}/?exchange={order['broker_id']}&pair={order['asset_id']}&timeframe=1d"
            response = requests.get(url)
            df = pd.DataFrame(
                response.json(),
                columns=["time", "open", "high", "low", "close", "volume"],
            )
            self.data[order["asset_id"]] = df
        return self.data[order["asset_id"]]

    @staticmethod
    def get_execution_tmstmp(ohlcv_df: pd.DataFrame, order: pd.Series) -> datetime:
        execution_df = ohlcv_df[
            ohlcv_df["time"]
            >= datetime.timestamp(order["order_creation_tmstmp"]) * 1000
        ]
        if order["order_side"] == "buy":
            execution_df = execution_df[execution_df["low"] < order["order_price"]]
        else:
            execution_df = execution_df[execution_df["high"] > order["order_price"]]
        if not execution_df.empty:
            return datetime.fromtimestamp(execution_df["time"].min() / 1000)

    def check_order(self, order_id: str):
        order = self.open_orders_df[
            self.open_orders_df["order_id"] == order_id
        ].squeeze()
        ohlcv_df = self.get_ohlcv(order)
        execution_tmstmp = self.get_execution_tmstmp(ohlcv_df, order)
        if execution_tmstmp:
            self.filled_orders[order_id] = execution_tmstmp

    def check_all_open_orders(self):
        orders = self.open_orders_df["order_id"].unique().tolist()
        threads = []
        for order_id in orders:
            self.check_order(order_id)
        #     thread = threading.Thread(target=self.check_order, args=(order_id,))
        #     threads.append(thread)
        #     thread.start()
        # for thread in threads:
        #     thread.join()

    async def cancel_previous_records(self):
        order_id_list = list(self.filled_orders.keys())
        order_id_list = "','".join(order_id_list)
        query = f"update crypto_station.public.crypto_station_api_orders set expiration_tmstmp = '{datetime.now()}' where order_id in ('{order_id_list}') and expiration_tmstmp is null"
        with self.db.cursor() as cursor:
            cursor.execute(query)

    async def add_updated_order_rows(self):
        df = pd.DataFrame()
        for order_id in self.filled_orders:
            order_df = self.open_orders_df[self.open_orders_df["order_id"] == order_id]
            df = pd.concat([df, order_df])
        df.loc[:, "insert_tmstmp"] = datetime.now()
        df.loc[:, "fill_pct"] = 1
        df.loc[:, "order_status"] = "executed"
        df.to_sql(
            "crypto_station_api_orders",
            schema="public",
            con=self.db,
            if_exists="append",
            index=False,
        )

    async def update_orders(self):
        await self.cancel_previous_records()
        await self.add_updated_order_rows()

    async def add_trades(self):
        ...

    async def update_db(self):
        await self.update_orders()
        await self.add_trades()

    def run_on_start_checker(self):
        self.check_all_open_orders()
        loop = asyncio.get_event_loop()
        loop.run_until_complete(self.update_db())
        loop.close()


class OrderExecutionService(OnStartChecker):
    def __init__(self):
        self.users = None
        redis_host = "localhost"
        redis_port = 6379
        self.redis_client = redis.StrictRedis(
            host=redis_host, port=redis_port, decode_responses=True
        )
        self.db, self.engine = get_db_connection()
        super().__init__(
            open_orders_df=self.retrieve_from_db(), db=self.db, engine=self.engine
        )
        self.run_on_start_checker()

    def retrieve_from_db(self) -> pd.DataFrame:
        query = "select * from crypto_station.public.crypto_station_api_orders where order_status = 'open' and expiration_tmstmp is null"
        return pd.read_sql_query(sql=query, con=self.db)

    def add_user_channels(self):
        df = self.retrieve_from_db()
        self.users = df["user_id"].unique().tolist()
        for user in self.users:
            user_df = df[df["user_id"] == user]
            self.redis_client.delete(user)
            self.redis_client.set(user, json.dumps(user_df.to_dict(orient="records")))

    def retrieve_from_redis(self) -> pd.DataFrame:
        all_data = dict()
        for user in self.users:
            all_data[user] = self.redis_client.get(user)
        return pd.DataFrame(all_data)

    def initialize_websocket(self):
        redis_data = self.retrieve_from_redis()
        brokers = redis_data["broker_id"].unique().tolist()
        for broker in brokers:
            broker_df = redis_data[redis_data["broker_id"] == broker]
            assets = broker_df["asset_id"].unique().tolist()
        # f = FeedHandler(config=self.config)


def run_service():
    while True:
        ...


if __name__ == "__main__":
    oes = OrderExecutionService()
