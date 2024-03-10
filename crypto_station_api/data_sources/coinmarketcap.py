import json
import os
from pathlib import Path

from dotenv import load_dotenv
from requests import Session

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"

load_dotenv(ENV_PATH, verbose=True)


class CoinMarketCap:
    base_url = "https://pro-api.coinmarketcap.com"

    def __init__(self):
        headers = {
            "Accepts": "application/json",
            "X-CMC_PRO_API_KEY": os.environ["COIN_MARKET_CAP_API_KEY"],
        }
        self.session = Session()
        self.session.headers.update(headers)

    def get_endpoint(self, api_version: int, category: str, endpoint: str) -> dict:
        url = f"{self.base_url}/v{api_version}/{category}/{endpoint}"
        response = self.session.get(url)
        return json.loads(response.text)
