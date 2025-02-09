import asyncio
import os
import sys
import warnings

import pandas as pd
import requests
from ccxt import BadSymbol
from dotenv import load_dotenv
from sqlalchemy import sql
from sqlalchemy.exc import ProgrammingError

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from services.ai.indicators import Indicators
from utils import helpers

load_dotenv(helpers.ENV_PATH, verbose=True)
warnings.filterwarnings("ignore")


class TrainingDataset(Indicators):
    available_pairs: dict
    min_data_amt: int = 365

    ohlcv_table: str = "ohlcv"

    exchanges: list[str] = ["binance", "coinbase"]

    def __init__(self, force_refresh: bool):
        super().__init__()
        self.force_refresh = force_refresh
        self.pre_stored_pairs = self.get_pre_stored_pairs()

    @staticmethod
    def call_coinmarket_cap(endpoint: str) -> dict:
        endpoint = f"https://pro-api.coinmarketcap.com/v1/cryptocurrency/{endpoint}"
        headers = {"X-CMC_PRO_API_KEY": os.environ.get("COIN_MARKET_CAP_API_KEY")}
        resp = requests.get(url=endpoint, headers=headers)
        return resp.json()["data"]

    def get_pre_stored_pairs(self) -> list[str]:
        query = f"select distinct pair from training_data.{self.ohlcv_table}"
        df = pd.read_sql(sql=query, con=self.db)
        pairs = df["pair"].unique().tolist()
        self.log.info(f"{len(pairs)} pairs available in DB")
        return pairs

    def get_stable_coins_categories(self) -> list[str]:
        data = self.call_coinmarket_cap("categories")
        stable_coins_category_id = list()
        for category in data:
            if "STABLE" in str(category).upper():
                stable_coins_category_id.append(category["id"])
        return stable_coins_category_id

    def get_stable_coins(self) -> list[str]:
        id_list = self.get_stable_coins_categories()
        coins = list()
        for category_id in id_list:
            data = self.call_coinmarket_cap(f"category?id={category_id}")
            for coin in data["coins"]:
                coins.append(coin["symbol"])
        return coins

    def get_available_pairs(self) -> dict:
        self.log.info("Retrieving available pairs")
        pairs = dict()
        stable_coins = self.get_stable_coins()
        for exchange in self.exchanges:
            exchange_object = helpers.get_exchange_object(exchange, async_mode=False)
            exchange_pairs = exchange_object.load_markets()
            for pair, pair_details in exchange_pairs.items():
                base = pair_details["base"]
                quote = pair_details["quote"]
                if (
                    any(quote == usd for usd in ("USD", "USDC", "USDT"))
                    and base not in stable_coins
                    and pair_details["type"] == "spot"
                ):
                    if base not in pairs:
                        pairs[base] = list()
                    if pair not in pairs[base]:
                        pairs[base].append(pair)
        self.log.info(f"{len(pairs)} available pairs")
        return pairs

    def get_pair_ohlcv(self, asset: str):
        """Get largest OHLCV for a given asset across various pairs (USD, USDC, USDT) and exchange"""
        self.pair_df = pd.DataFrame()
        final_pair = ""
        final_exchange = ""
        for exchange in self.exchanges:
            pairs = self.available_pairs[asset]
            for pair in pairs:
                try:
                    exchange_object = helpers.get_exchange_object(
                        exchange, async_mode=False
                    )
                    ohlcv_data = helpers.get_ohlcv_history(
                        pair=pair,
                        exchange=exchange_object,
                        timeframe="1d",
                        full_history=True,
                    )
                    self.log.info(f"    Checking {exchange}: {pair}")
                    df = pd.DataFrame(
                        ohlcv_data,
                        columns=[
                            "calendar_dt",
                            "open",
                            "high",
                            "low",
                            "close",
                            "volume",
                        ],
                    )
                    df["calendar_dt"] = pd.to_datetime(
                        df["calendar_dt"], utc=True, unit="ms"
                    ).dt.date
                    df.sort_values(by="calendar_dt", inplace=True)
                    df.drop_duplicates(inplace=True)
                    if self.pair_df.empty or len(df) >= len(self.pair_df):
                        final_pair = pair
                        final_exchange = exchange
                        df["pair"] = pair
                        df["pair_formatted"] = f"{asset}/USD"
                        self.pair_df = df.iloc[1:-1]
                except BadSymbol:
                    pass
        self.log.info(
            f"    Pair with the most amount of data is {final_exchange}: {final_pair}"
        )

    def update_table(self, table_name: str):
        pair = self.pair_df["pair"].iloc[0]
        query = f"delete from training_data.{table_name} where pair = '{pair}'"
        with self.db.connect() as connection:
            try:
                connection.execute(sql.text(query))
                connection.commit()
            except ProgrammingError:
                self.log.info(f"'training_data.{table_name}' does not yet exist")
        self.pair_df.to_sql(
            name=table_name,
            schema="training_data",
            con=self.db,
            if_exists="append",
            index=False,
        )
        self.log.info(
            f"    Added {len(self.pair_df)} rows to '{table_name}' table for '{pair}'"
        )

    def should_get_data(self, pair: str) -> bool:
        if self.force_refresh:
            return True
        if pair not in self.pre_stored_pairs:
            return True
        return False

    def load_training_dataset(self, pairs: list[str] = None) -> pd.DataFrame:
        self.log.info("Loading training data")
        query = "select * from training_data.training_dataset"
        if pairs:
            pairs_str = "','".join(pairs)
            query += f" where pair in ('{pairs_str}')"
        query += " order by calendar_dt"
        df = pd.read_sql_query(sql=query, con=self.db)
        self.log.info(f"Retrieved {len(df)} rows")
        return df

    async def get_raw_training_dataset(self):
        self.available_pairs = self.get_available_pairs()
        for asset in self.available_pairs:
            pair = f"{asset}/USD"
            if self.should_get_data(pair):
                self.log.info(f"Processing {pair}")
                self.get_pair_ohlcv(asset)
                if len(self.pair_df) < self.min_data_amt:
                    self.log.warning(
                        f"    Skipping {pair}, available data: {len(self.pair_df)} days"
                    )
                else:
                    self.update_table(table_name=self.ohlcv_table)
                    self.compute_key_levels()


if __name__ == "__main__":
    dataset = TrainingDataset(force_refresh=False)
    asyncio.run(dataset.get_raw_training_dataset())
