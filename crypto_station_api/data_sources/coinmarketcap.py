import json

from requests import Session

class CoinMarketCap:
    base_url = "https://pro-api.coinmarketcap.com"

    def __init__(self):
        headers = {
            'Accepts': 'application/json',
            'X-CMC_PRO_API_KEY': '06736774-dad8-4b3d-8243-b9be9f47195f',
        }
        self.session = Session()
        self.session.headers.update(headers)

    def get_endpoint(self, api_version: int, category: str, endpoint: str) -> dict:
        url = f"{self.base_url}/v{api_version}/{category}/{endpoint}"
        response = self.session.get(url)
        return json.loads(response.text)