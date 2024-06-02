from datetime import datetime
import os
import sys
from dotenv import load_dotenv
import pandas as pd
import requests
from sqlalchemy import text

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from utils import helpers

load_dotenv(verbose=True)
LOG = helpers.get_logger("market_data_db_updates")


class MarketDataDbUpdates:
    def __init__(
        self,
        ref_currency="USDC",
        exchange_list: list = ["coinbase"],
        time_periods: list = ["1m", "1d"],
    ):
        LOG.info("Launching Market Data DB Updates")
        self.db = helpers.get_db_connection()
        self.ref_currency = ref_currency
        self.exchange_list = exchange_list
        self.time_periods = time_periods

    @helpers.call_with_retries
    def call_ohlcv_api(
        self, pair: str, exchange: str, time_period: str, from_tmstmp: int = None
    ) -> pd.DataFrame:
        log = f"Will retrieve OHLCV data for {exchange}:{pair}"
        url = f"{helpers.BASE_API}/ohlc/?exchange={exchange}&pair={pair}&timeframe={time_period}&from_db=n"
        if not from_tmstmp:
            url += "&full_history=y"
            log += " FULL HISTORY"
        else:
            url += f"&from_timestamp={from_tmstmp:.0f}"
            log += (
                f" since {datetime.fromtimestamp(from_tmstmp/1000):%Y-%m-%d %H:%M:%S}"
            )
        LOG.info(log)
        ohlcv = requests.get(url)
        error_message = ohlcv.text if ohlcv.status_code != 200 else None
        if not error_message:
            df = pd.DataFrame(
                data=ohlcv.json(),
                columns=["timestamp", "open", "high", "low", "close", "volume"],
            )
            if from_tmstmp:
                df = df[df["timestamp"] >= from_tmstmp]
            df["pair"] = pair
            df["exchange"] = exchange
            df["time_period"] = time_period
            df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms")
            df["insert_tmstmp"] = datetime.now()
            return df.sort_values(by="timestamp")
        else:
            LOG.error(error_message)

    def clear_stale_record(
        self,
        exchange: str,
        pair: str,
        time_period: str,
        latest_update_tmstmp: pd.Timestamp,
    ):
        if latest_update_tmstmp:
            query = f"delete from market_data.ohlcv where exchange = '{exchange}' and pair = '{pair}' and time_period = '{time_period}' and timestamp >= '{latest_update_tmstmp}'"
            with self.db.connect() as conn:
                res = conn.execute(text(query))
                conn.commit()
            LOG.info(
                f"Deleted {res.rowcount} rows from OHLCV for {exchange}:{pair} {time_period}"
            )

    def update_pair(self, exchange: str, pair: str):
        for time_period in self.time_periods:
            LOG.info(f"Updating {pair} | time period: {time_period}")
            query = f"select max(timestamp) as latest_update_tmstmp from market_data.ohlcv where exchange = '{exchange}' and pair = '{pair}' and time_period = '{time_period}'"
            df = pd.read_sql_query(sql=query, con=self.db)
            latest_update_tmstmp = df["latest_update_tmstmp"].item()
            latest_update_tmstmp = (
                latest_update_tmstmp.timestamp() * 1000
                if latest_update_tmstmp
                else None
            )
            ohlcv_data = self.call_ohlcv_api(
                pair=pair,
                exchange=exchange,
                time_period=time_period,
                from_tmstmp=latest_update_tmstmp,
            )
            if ohlcv_data is None or ohlcv_data.empty:
                LOG.error(f"No OHLCV data for {exchange}:{pair} {time_period}")
            else:
                latest_update_tmstmp = ohlcv_data.iloc[0]["timestamp"]
                self.clear_stale_record(
                    exchange=exchange,
                    pair=pair,
                    time_period=time_period,
                    latest_update_tmstmp=latest_update_tmstmp,
                )
                ohlcv_data.to_sql(
                    name="ohlcv",
                    con=self.db,
                    schema="market_data",
                    if_exists="append",
                    index=False,
                )
                LOG.info(f"Added {len(ohlcv_data):.0f} rows to OHLCV table")

    def update_all_exchanges(self):
        for exchange in self.exchange_list:
            exchange_object = helpers.get_exchange_object(
                exchange=exchange, async_mode=False
            )
            pairs = exchange_object.load_markets()
            for pair in pairs:
                if pair.endswith(self.ref_currency):
                    self.update_pair(exchange=exchange, pair=pair)

    def run(self):
        while True:
            self.update_all_exchanges()


if __name__ == "__main__":
    db = MarketDataDbUpdates()
    db.run()
