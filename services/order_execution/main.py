import json
import os
from pathlib import Path

import msgpack
import pandas as pd
import psycopg2
import redis
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_PATH = BASE_DIR / ".env"
load_dotenv(ENV_PATH, verbose=True)


def get_db_connection() -> psycopg2:
    user = os.getenv("DB_USER")
    pwd = os.getenv("POSTGRES_PASSWORD")
    db_name = os.getenv("DB_NAME")
    host = os.getenv("DB_HOST")
    port = os.getenv("DB_PORT")
    dsn = f"postgresql://{user}:{pwd}@{host}:{port}/{db_name}"
    return psycopg2.connect(dsn)


class OrderExecutionService:
    def __init__(self):
        self.users = None
        redis_host = "localhost"
        redis_port = 6379
        self.redis_client = redis.StrictRedis(
            host=redis_host, port=redis_port, decode_responses=True
        )
        self.db = get_db_connection()

    def retrieve_from_db(self) -> pd.DataFrame:
        query = "select * from crypto_station.public.crypto_station_api_orders where order_status = 'open'"
        df = pd.read_sql_query(sql=query, con=self.db)
        df["order_creation_tmstmp"] = (
            df["order_creation_tmstmp"].astype("int64").astype("int32") // 10**9
        )
        return df

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
