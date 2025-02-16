import asyncio
import logging
import os
import pickle
import time
from datetime import datetime as dt, timedelta
from pathlib import Path

import aiohttp
import boto3
import ccxt

# import django
# import environ
import pandas as pd
import sqlalchemy as sql
from botocore.exceptions import ClientError
from ccxt import async_support as async_ccxt
from dotenv import load_dotenv
from tenacity import retry, stop_after_attempt
from xgboost import XGBClassifier

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"

load_dotenv(ENV_PATH, verbose=True)
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

THROTLE_PERIOD = 1
MAX_RETRIES = 20

S3_CLIENT = boto3.client("s3", region_name=os.getenv("PREFERRED_AWS_REGION"))


def get_api_keys(exchange: str, websocket: bool = False) -> dict:
    # try:
    #     key = env(f"{exchange}_api_key")
    #     secret = env(f"{exchange}_api_secret")
    # except django.core.exceptions.ImproperlyConfigured:
    key = os.environ.get(f"{exchange}_api_key")
    secret = os.environ.get(f"{exchange}_api_secret")
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
    options = dict()
    options["options"] = dict(adjustForTimeDifference=False)
    keys = get_api_keys(exchange)
    if keys:
        options = {**options, **keys}
    return exchange_class(options)


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
    def wrapper(*args, **kwargs):
        success = False
        retry_i = 0
        while not success and retry_i <= MAX_RETRIES:
            try:
                response = func(*args, **kwargs)
                success = True
                return response
            except Exception as e:
                retry_i += 1
                logging.warning(
                    f"\n Attempt {retry_i} | Will retry in {THROTLE_PERIOD} seconds | {e} \n"
                )
                time.sleep(THROTLE_PERIOD)

    return wrapper


def a_call_with_retries(func):
    async def wrapper(*args, **kwargs):
        success = False
        retry_i = 0
        while not success and retry_i <= MAX_RETRIES:
            try:
                response = await func(*args, **kwargs)
                success = True
                return response
            except Exception as e:
                retry_i += 1
                logging.warning(
                    f"\n Attempt {retry_i} | Will retry in {THROTLE_PERIOD} seconds | {e} \n"
                )
                await asyncio.sleep(THROTLE_PERIOD)

    return wrapper


@retry(stop=stop_after_attempt(3))
def _fetch_ohlcv(
    exchange: ccxt.Exchange, pair: str, timeframe: str, limit: int, from_tmstmp: int
):
    return exchange.fetch_ohlcv(
        symbol=pair, timeframe=timeframe, limit=limit, since=from_tmstmp
    )


def get_ohlcv_history(
    pair: str,
    exchange: ccxt.Exchange,
    timeframe: str,
    from_tmstmp: int = None,
    full_history: bool = False,
) -> list:
    limit = 200
    time_unit = timeframe[-1:]
    time_multiplier = int(timeframe[:-1])
    all_history_fetched = False
    ohlc_data = list()
    full_history = full_history

    while not all_history_fetched:
        _ohlc_data = exchange.fetch_ohlcv(
            symbol=pair, timeframe=timeframe, limit=limit, since=from_tmstmp
        )
        if not _ohlc_data:
            return _ohlc_data
        else:
            if full_history:
                oldest_tmstmp = _ohlc_data[0][0]
                new_from_tmstmp = oldest_tmstmp - (
                    limit * UNITS_TO_MILLISECONDS[time_unit] * time_multiplier
                )
                all_history_fetched = (
                    True
                    if new_from_tmstmp == from_tmstmp or len(_ohlc_data) < limit
                    else False
                )
                if not all_history_fetched:
                    from_tmstmp = new_from_tmstmp
            else:
                if len(_ohlc_data) <= 1:
                    all_history_fetched = True
                else:
                    time_delta = (_ohlc_data[1][0] - _ohlc_data[0][0]) / 1000
                    latest_tmstmp = int(_ohlc_data[len(_ohlc_data) - 1][0])
                    if dt.now() - timedelta(seconds=time_delta) > dt.fromtimestamp(
                        latest_tmstmp / 1000
                    ):
                        from_tmstmp = latest_tmstmp
                    else:
                        all_history_fetched = True
            ohlc_data += _ohlc_data
    return ohlc_data


def write_file_to_s3(
    local_path: str, content_to_write: str or XGBClassifier, is_pickle: bool = False
):
    path = Path(local_path)
    if is_pickle:
        pickle.dump(content_to_write, open(local_path, "wb"))
    else:
        with open(path, "w") as f:
            f.write(content_to_write)
    bucket_name = "cmetrics-ai"
    file_name = path.name
    S3_CLIENT.upload_file(Filename=local_path, Bucket=bucket_name, Key=file_name)


def load_from_s3(file_name: str):
    bucket_name = "cmetrics-ai"
    local_path = f"./services/ai/assets/{file_name}"
    try:
        S3_CLIENT.download_file(bucket_name, file_name, local_path)
    except ClientError:
        print(f"Could not download '{file_name}' file from S3")
