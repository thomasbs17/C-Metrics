import asyncio
import json
import os
import uuid
from datetime import datetime
from pathlib import Path

import pandas as pd
import redis
import requests
import sqlalchemy as sql
from dotenv import load_dotenv
import websockets

WS_URL = "ws://localhost:8768"
BASE_API_URL = "http://127.0.0.1:8000/ohlc"
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_PATH = BASE_DIR / ".env"
load_dotenv(ENV_PATH, verbose=True)


def get_db_connection() -> sql.Engine:
    user = os.getenv("DB_USER")
    pwd = os.getenv("POSTGRES_PASSWORD")
    db_name = os.getenv("DB_NAME")
    host = os.getenv("DB_HOST")
    port = os.getenv("DB_PORT")
    dsn = f"postgresql://{user}:{pwd}@{host}:{port}/{db_name}"
    return sql.create_engine(dsn)


class OnStartChecker:
    def __init__(self, open_orders_df: pd.DataFrame, db: sql.Engine):
        self.open_orders_df = open_orders_df
        self.data = dict()
        self.filled_orders = dict()
        self.db = db

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
        for order_id in orders:
            self.check_order(order_id)

    async def cancel_previous_records(self):
        order_id_list = list(self.filled_orders.keys())
        order_id_list = "','".join(order_id_list)
        query = (
            f"update crypto_station_api_orders set expiration_tmstmp = '{datetime.now()}' "
            f"where order_id in ('{order_id_list}') and expiration_tmstmp is null"
        )
        with self.db.connect() as connection:
            connection.execute(sql.text(query))
            connection.commit()

    def get_updated_order_rows_df(self) -> pd.DataFrame:
        df = pd.DataFrame()
        for order_id in self.filled_orders:
            order_df = self.open_orders_df[self.open_orders_df["order_id"] == order_id]
            df = pd.concat([df, order_df])
        df.loc[:, "insert_tmstmp"] = datetime.now()
        df.loc[:, "fill_pct"] = 1
        df.loc[:, "order_status"] = "executed"
        df["order_dim_key"] = df.apply(lambda x: str(uuid.uuid4()), axis=1)
        return df

    async def add_updated_order_rows(self):
        df = self.get_updated_order_rows_df()
        df.to_sql(
            "crypto_station_api_orders",
            con=self.db,
            if_exists="append",
            index=False,
        )

    async def update_orders(self):
        await self.cancel_previous_records()
        await self.add_updated_order_rows()

    def get_trades_df(self) -> pd.DataFrame:
        df = self.get_updated_order_rows_df()
        df = df.drop(
            columns=[
                "order_dim_key",
                "order_type",
                "order_creation_tmstmp",
                "order_status",
                "fill_pct",
            ]
        )
        df = df.drop_duplicates()
        for id_col in ("trade_dim_key", "trade_id"):
            df[id_col] = df.apply(lambda x: str(uuid.uuid4()), axis=1)
        for column in ("side", "price", "volume"):
            df = df.rename(columns={f"order_{column}": f"trade_{column}"})
        df.loc[:, "insert_tmstmp"] = datetime.now()
        df["execution_tmstmp"] = df["order_id"].apply(lambda x: self.filled_orders[x])
        return df

    async def add_trades(self):
        df = self.get_trades_df()
        df.to_sql(
            "crypto_station_api_trades",
            con=self.db,
            if_exists="append",
            index=False,
        )

    async def update_db(self):
        await self.update_orders()
        await self.add_trades()

    def run_on_start_checker(self):
        self.check_all_open_orders()
        if self.filled_orders:
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
        self.db = get_db_connection()
        super().__init__(open_orders_df=self.retrieve_from_db(), db=self.db)
        self.run_on_start_checker()
        self.add_user_channels()

    def retrieve_from_db(self) -> pd.DataFrame:
        query = (
            "select * from crypto_station.public.crypto_station_api_orders "
            "where order_status = 'open' and expiration_tmstmp is null"
        )
        return pd.read_sql_query(sql=query, con=self.db)

    def add_user_channels(self):
        df = self.retrieve_from_db()
        self.users = df["user_id"].unique().tolist()
        for user in self.users:
            user_df = df[df["user_id"] == user]
            for col in user_df.columns:
                if col.endswith("tmstmp"):
                    user_df[col] = (
                        pd.to_datetime(user_df[col], utc=True).astype(int) // 10**9
                    )
            self.redis_client.delete(user)
            self.redis_client.set(user, json.dumps(user_df.to_dict(orient="records")))

    def retrieve_from_redis(self, user_id: str) -> pd.DataFrame:
        all_data = dict()
        redis_data = self.redis_client.get(user_id)
        return pd.DataFrame(json.loads(redis_data))

    def get_asset_list(self, broker: str) -> list:
        redis_data = self.retrieve_from_redis("thomasbouamoud")
        broker_df = redis_data[redis_data["broker_id"] == broker]
        return broker_df["asset_id"].unique().tolist()

    async def initialize_websocket(self):
        broker = "kraken"
        assets = self.get_asset_list(broker)
        uri = f"{WS_URL}?exchange={broker}?trades={','.join(assets)}"
        try:
            async with websockets.connect(uri) as websocket:
                while True:
                    response = await websocket.recv()
                    print(response)
        except ConnectionRefusedError:
            print("The Real Time Data service is down.")


if __name__ == "__main__":
    oes = OrderExecutionService()
    asyncio.get_event_loop().run_until_complete(oes.initialize_websocket())
