import asyncio
import json
import os
import platform
import uuid
from datetime import datetime as dt
from pathlib import Path

import pandas as pd
import redis
import requests
import sqlalchemy as sql
import websockets
from dotenv import load_dotenv

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


def datetime_unix_conversion(
    df: pd.DataFrame, convert_to: str, cols: list = None
) -> pd.DataFrame:
    cols = cols if cols else df.columns
    for col in cols:
        if col.endswith("tmstmp"):
            if convert_to == "unix":
                df[col] = pd.to_datetime(df[col], utc=True).astype("int64") // 10**9
            else:
                df[col] = df[col].apply(lambda x: dt.utcfromtimestamp(x))
    return df


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
    def get_execution_tmstmp(ohlcv_df: pd.DataFrame, order: pd.Series) -> dt:
        execution_df = ohlcv_df[
            ohlcv_df["time"] >= dt.timestamp(order["order_creation_tmstmp"]) * 1000
        ]
        if order["order_side"] == "buy":
            execution_df = execution_df[execution_df["low"] < order["order_price"]]
        else:
            execution_df = execution_df[execution_df["high"] > order["order_price"]]
        if not execution_df.empty:
            return dt.fromtimestamp(execution_df["time"].min() / 1000)

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

    async def cancel_previous_records(self, orders_df: pd.DataFrame = None):
        order_id_list = (
            list(self.filled_orders.keys())
            if orders_df is None
            else orders_df["order_id"].tolist()
        )
        order_id_list = "','".join(order_id_list)
        query = (
            f"update crypto_station_api_orders set expiration_tmstmp = '{dt.now()}' "
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
        df.loc[:, "insert_tmstmp"] = dt.now()
        df.loc[:, "fill_pct"] = 1
        df.loc[:, "order_status"] = "executed"
        df["order_dim_key"] = df.apply(lambda x: str(uuid.uuid4()), axis=1)
        return df

    async def add_updated_order_rows(self, orders_df: pd.DataFrame = None):
        if orders_df is None:
            orders_df = self.get_updated_order_rows_df()
        orders_df["order_dim_key"] = str(uuid.uuid4())
        orders_df.to_sql(
            "crypto_station_api_orders",
            con=self.db,
            if_exists="append",
            index=False,
        )

    async def update_orders(self, orders_df: pd.DataFrame = None):
        await self.cancel_previous_records(orders_df)
        await self.add_updated_order_rows(orders_df)

    def get_trades_df(self, updates_orders_df: pd.DataFrame = None) -> pd.DataFrame:
        if updates_orders_df is None:
            updates_orders_df = self.get_updated_order_rows_df()
        trades_df = updates_orders_df.drop(
            columns=[
                "order_dim_key",
                "order_type",
                "order_creation_tmstmp",
                "order_status",
                "fill_pct",
            ]
        )
        trades_df = trades_df.drop_duplicates()
        for id_col in ("trade_dim_key", "trade_id"):
            trades_df[id_col] = trades_df.apply(lambda x: str(uuid.uuid4()), axis=1)
        for column in ("side", "price", "volume"):
            trades_df = trades_df.rename(columns={f"order_{column}": f"trade_{column}"})
        trades_df.loc[:, "insert_tmstmp"] = dt.now()
        trades_df["execution_tmstmp"] = (
            trades_df["order_id"].apply(lambda x: self.filled_orders[x])
            if updates_orders_df is None
            else dt.now()
        )
        return trades_df

    async def add_trades(self, trades_df: pd.DataFrame = None):
        if trades_df is None:
            trades_df = self.get_trades_df()
        trades_df.to_sql(
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
        self.orders = self.retrieve_from_db()
        if "linux" not in platform.platform():
            super().__init__(open_orders_df=self.orders, db=self.db)
        self.run_on_start_checker()
        self.add_user_channels()

    def retrieve_from_db(self) -> pd.DataFrame:
        query = (
            "select * from crypto_station.public.crypto_station_api_orders "
            "where order_status = 'open' and expiration_tmstmp is null"
        )
        return pd.read_sql_query(sql=query, con=self.db)

    def add_user_channels(self):
        self.users = self.orders["user_id"].unique().tolist()
        for user in self.users:
            user_df = self.orders[self.orders["user_id"] == user]
            user_df = datetime_unix_conversion(user_df, convert_to="unix")
            self.redis_client.delete(user)
            self.redis_client.set(user, json.dumps(user_df.to_dict(orient="records")))

    def retrieve_from_redis(self, user_id: str) -> pd.DataFrame:
        redis_data = self.redis_client.get(user_id)
        return pd.DataFrame(json.loads(redis_data))

    def get_asset_list(self, broker: str) -> list:
        redis_data = self.retrieve_from_redis("thomasbouamoud")
        broker_df = redis_data[redis_data["broker_id"] == broker]
        return [
            asset.lower().replace("/", "-")
            for asset in broker_df["asset_id"].unique().tolist()
        ]

    @staticmethod
    def get_filled_qty(order: pd.Series, trade_data: dict) -> float:
        if (
            order["order_side"] == "buy" and trade_data["price"] < order["order_price"]
        ) or (
            order["order_side"] == "sell" and trade_data["price"] > order["order_price"]
        ):
            return order["order_volume"]
        if trade_data["price"] == order["order_price"]:
            return min(trade_data["amount"], order["order_volume"])
        return 0

    async def handle_fills(self, filled_orders: pd.DataFrame):
        if not filled_orders.empty:
            filled_orders["fill_pct"] = filled_orders.apply(
                lambda x: round(x["filled_qty"] / x["order_volume"], 4), axis=1
            )
            filled_orders["order_status"] = filled_orders["fill_pct"].apply(
                lambda x: "executed" if x == 1 else "part_fill"
            )
            filled_orders["insert_tmstmp"] = dt.now()
            filled_orders["expiration_tmstmp"] = None
            filled_orders = datetime_unix_conversion(
                filled_orders, convert_to="timestamp", cols=["order_creation_tmstmp"]
            )
            filled_orders["order_volume"] = filled_orders["filled_qty"]
            filled_orders.drop(columns="filled_qty", inplace=True)
            trades_df = self.get_trades_df(filled_orders)
            await self.update_orders(filled_orders)
            await self.add_trades(trades_df)

    async def check_fills(self, raw_trade_data: str):
        trade_data = json.loads(raw_trade_data)
        trade_data = trade_data["trades"]
        orders = self.retrieve_from_redis("thomasbouamoud")
        trade_pair = trade_data["symbol"]
        trade_pair = trade_pair.replace("-", "/")
        orders = orders[orders["asset_id"] == trade_pair]
        orders["filled_qty"] = orders.apply(
            lambda x: self.get_filled_qty(x, trade_data), axis=1
        )
        orders["filled_qty"] = orders["order_volume"]
        filled_orders = orders[orders["filled_qty"] > 0]
        await self.handle_fills(filled_orders)

    async def initialize_websocket(self):
        broker = "coinbase"
        assets = self.get_asset_list(broker)
        uri = f"{WS_URL}?exchange={broker}?trades={','.join(assets)}"
        try:
            async with websockets.connect(uri, ping_interval=None) as websocket:
                while True:
                    response = await websocket.recv()
                    if response != "heartbeat":
                        await self.check_fills(response)
        except (
            ConnectionRefusedError
            or websockets.ConnectionClosedError
            or asyncio.IncompleteReadError
        ):
            print("The Real Time Data service is down.")


if __name__ == "__main__":
    oes = OrderExecutionService()
    asyncio.get_event_loop().run_until_complete(oes.initialize_websocket())
