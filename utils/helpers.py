import asyncio
from pathlib import Path

import ccxt
import django
import environ
from ccxt import async_support as async_ccxt, ExchangeError
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"

load_dotenv(ENV_PATH, verbose=True)
env = environ.Env()
environ.Env.read_env()

API_LIMIT_RETRY_DELAY = 20


def get_api_keys(exchange: str) -> dict:
    try:
        key = env(f"{exchange}_api_key")
        secret = env(f"{exchange}_api_secret")
    except django.core.exceptions.ImproperlyConfigured:
        key = secret = None
    if key and secret:
        return dict(apiKey=key, secret=secret)


def get_exchange_object(exchange: str, async_mode: bool) -> ccxt.Exchange:
    module = async_ccxt if async_mode else ccxt
    exchange_class = getattr(module, exchange)
    keys = get_api_keys(exchange)
    return exchange_class(keys) if keys else exchange_class()


def run_with_rate_limits(func):
    async def try_get_until_success(*args, **kwargs):
        done = False
        while not done:
            try:
                await func(*args, **kwargs)
                done = True
            except ExchangeError:
                print(
                    f"Rate limited. Will try again in {API_LIMIT_RETRY_DELAY} seconds."
                )
                await asyncio.sleep(API_LIMIT_RETRY_DELAY)

    return try_get_until_success
