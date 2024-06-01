import asyncio
import logging
import os
import time
from datetime import datetime as dt
from pathlib import Path

import aiohttp
import ccxt
from ccxt.base import errors
import django
import environ
import pandas as pd
import sqlalchemy as sql
from ccxt import async_support as async_ccxt
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"

load_dotenv(ENV_PATH, verbose=True)
env = environ.Env()
environ.Env.read_env()
HOST = "localhost"
BASE_WS = f"ws://{HOST}:"
BASE_API = "http://127.0.0.1:8000"

UNITS_TO_MILLISECONDS = {
    "s": 1000,
    "m": 60 * 1000,
    "h": 60 * 60 * 1000,
    "d": 24 * 60 * 60 * 1000,
    "w": 7 * 24 * 60 * 60 * 1000,
    "M": 30 * 24 * 60 * 60 * 1000,  # Assuming a month has 30 days
}

MAX_OHLCV_SIZE = 300


def get_api_keys(exchange: str, websocket: bool = False) -> dict:
    try:
        key = env(f"{exchange}_api_key")
        secret = env(f"{exchange}_api_secret")
    except django.core.exceptions.ImproperlyConfigured:
        key = secret = None
    if key and secret:
        if websocket:
            return dict(key_id=key, key_secret=secret)
        else:
            return dict(apiKey=key, secret=secret)


def get_exchange_object(
    exchange: str, async_mode: bool
) -> ccxt.Exchange or async_ccxt.Exchange:
    module = async_ccxt if async_mode else ccxt
    exchange_class = getattr(module, exchange)
    keys = get_api_keys(exchange)
    return exchange_class(keys) if keys else exchange_class()


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


async def async_get(session: aiohttp.ClientSession, url: str, pair: str = None) -> list:
    async with session.get(url) as response:
        data = await response.json()
        if pair:
            return [pair, data]
        return data


def get_logger(logger_name: str) -> logging.Logger:
    logging.basicConfig(format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    logger = logging.getLogger(logger_name)
    logger.setLevel(logging.INFO)
    return logger


def call_with_retries(func):
    async def wrapper(*args):
        success = False
        throtle = 0.5
        max_retries = 10
        retry_i = 0
        while not success and retry_i <= max_retries:
            try:
                response = await func(*args)
                time.sleep(0.5)
                success = True
                return response
            except Exception as e:
                retry_i += 1
                logging.warning(
                    f"\n Attempt {retry_i} | Will retry in {throtle} seconds | {e} \n"
                )
                time.sleep(throtle)
                throtle += 1

    return wrapper


async def get_full_history_ohlcv(
    pair: str, exchange: async_ccxt.Exchange, timeframe: str
) -> list:
    time_unit = timeframe[-1:]
    time_multiplier = int(timeframe[:-1])
    new_target_tmstmp = None
    all_history_fetched = False
    ohlc_data = list()
    retry_i = 0
    throtle = 0.5

    while not all_history_fetched:
        if new_target_tmstmp:
            time.sleep(1)
        try:
            _ohlc_data = await exchange.fetch_ohlcv(
                symbol=pair, timeframe=timeframe, limit=300, since=new_target_tmstmp
            )
        except errors.BadSymbol:
            return []
        except Exception as e:
            retry_i += 1
            logging.warning(
                f"\n Attempt {retry_i} | Will retry in {throtle} seconds | {e} \n"
            )
            await asyncio.sleep(throtle)
            throtle += 1
        oldest_tmstmp = _ohlc_data[0][0]
        new_target_tmstmp = oldest_tmstmp - (
            MAX_OHLCV_SIZE * UNITS_TO_MILLISECONDS[time_unit] * time_multiplier
        )
        all_history_fetched = True if len(_ohlc_data) < 300 else False
        ohlc_data += _ohlc_data
    return ohlc_data
