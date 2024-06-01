import json
import uuid
from datetime import datetime as dt

import ccxt
import django
from asgiref.sync import sync_to_async
from ccxt.base import errors
from django.views.decorators.csrf import csrf_exempt
from GoogleNews import GoogleNews

from crypto_station_api.data_sources.coinmarketcap import CoinMarketCap
from crypto_station_api.models import Orders
from utils.helpers import (
    get_exchange_object,
    get_full_history_ohlcv,
)

coinmarketcap = CoinMarketCap()


@csrf_exempt
def login_view(request: django.core.handlers.wsgi.WSGIRequest):
    username = request.POST.get("username")
    password = request.POST.get("password")
    user = django.contrib.auth.authenticate(
        request, username=username, password=password
    )
    if user is not None:
        django.contrib.auth.login(request, user)
        return django.http.JsonResponse({"result": "ok"}, safe=False)
    else:
        return django.http.HttpResponseForbidden()


async def get_exchanges(request: django.core.handlers.wsgi.WSGIRequest):
    data = ccxt.exchanges
    return django.http.JsonResponse(data, safe=False)


async def get_ohlc(request: django.core.handlers.wsgi.WSGIRequest):
    exchange = request.GET.get("exchange")
    timeframe = request.GET.get("timeframe")
    pair = request.GET.get("pair")
    full_history = request.GET.get("full_history")
    exchange = get_exchange_object(exchange, async_mode=True)

    if full_history == "y":
        ohlc_data = await get_full_history_ohlcv(
            pair=pair, exchange=exchange, timeframe=timeframe
        )
        await exchange.close()
        ohlc_data.sort(key=lambda x: x[0])
        return django.http.JsonResponse(ohlc_data, safe=False)
    else:
        try:
            ohlc_data = await exchange.fetch_ohlcv(
                symbol=pair, timeframe=timeframe, limit=300
            )
        except errors.BadSymbol:
            ohlc_data = None
    await exchange.close()
    return django.http.JsonResponse(ohlc_data, safe=False)


async def get_order_book(request: django.core.handlers.wsgi.WSGIRequest):
    exchange = request.GET.get("exchange")
    pair = request.GET.get("pair")
    limit = request.GET.get("limit")
    exchange = get_exchange_object(exchange, async_mode=True)
    try:
        order_book_data = await exchange.fetch_order_book(
            symbol=pair, limit=int(limit) if limit else 10000
        )
    except:
        order_book_data = None
    await exchange.close()
    return django.http.JsonResponse(order_book_data, safe=False)


async def get_asset_coinmarketcap_mapping(
    request: django.core.handlers.wsgi.WSGIRequest,
):
    return django.http.JsonResponse(
        coinmarketcap.get_endpoint(
            api_version=1, category="cryptocurrency", endpoint="map"
        ),
        safe=False,
    )


async def get_crypto_meta_data(request: django.core.handlers.wsgi.WSGIRequest):
    crypto_coinmarketcap_id = request.GET.get("crypto_coinmarketcap_id")
    return django.http.JsonResponse(
        coinmarketcap.get_endpoint(
            api_version=2,
            category="cryptocurrency",
            endpoint=f"info?id={crypto_coinmarketcap_id}",
        ),
        safe=False,
    )


async def get_exchange_markets(request: django.core.handlers.wsgi.WSGIRequest):
    exchange = request.GET.get("exchange")
    exchange = get_exchange_object(exchange, async_mode=False)
    return django.http.JsonResponse(exchange.load_markets(), safe=False)


async def get_news(request: django.core.handlers.wsgi.WSGIRequest):
    pair = request.GET.get("search_term")
    googlenews = GoogleNews()
    googlenews.get_news(pair)
    data = googlenews.results()
    data = [
        article
        for article in data
        if isinstance(article["datetime"], dt) and article["datetime"] <= dt.now()
    ]
    return django.http.JsonResponse(data, safe=False)


async def get_public_trades(request: django.core.handlers.wsgi.WSGIRequest):
    exchange = request.GET.get("exchange")
    pair = request.GET.get("pair")
    exchange = get_exchange_object(exchange, async_mode=True)
    try:
        data = await exchange.fetch_trades(symbol=pair, limit=1000)
    except errors.BadSymbol:
        data = None
    await exchange.close()
    return django.http.JsonResponse(data, safe=False)


@csrf_exempt
async def post_new_order(request: django.core.handlers.wsgi.WSGIRequest):
    data = json.loads(request.body.decode("utf-8"))
    new_order = Orders(
        order_dim_key=str(uuid.uuid4()),
        user_id=data.get("user_id"),
        order_id=str(uuid.uuid4()),
        broker_id=data.get("broker_id"),
        trading_env=data.get("trading_env"),
        trading_type=data.get("trading_type"),
        asset_id=data.get("asset_id"),
        order_side=data.get("order_side"),
        order_type=data.get("order_type"),
        order_creation_tmstmp=dt.fromtimestamp(
            float(data.get("order_creation_tmstmp")) / 1000
        ),
        order_status=data.get("order_status"),
        fill_pct=data.get("fill_pct"),
        order_volume=data.get("order_volume"),
        order_price=data.get("order_price") if data.get("order_price") else 1,
        insert_tmstmp=dt.now(),
    )
    await sync_to_async(new_order.save)()
    return django.http.JsonResponse("success", safe=False)


@csrf_exempt
async def cancel_order(request: django.core.handlers.wsgi.WSGIRequest):
    data = json.loads(request.body.decode("utf-8"))
    order_dim_key = data.get("order_dim_key")
    order = Orders.objects.filter(order_dim_key=order_dim_key)
    await sync_to_async(order.update)(expiration_tmstmp=dt.now())
    new_row = Orders(
        order_dim_key=str(uuid.uuid4()),
        user_id=order.values("user_id"),
        order_id=order.values("order_id"),
        broker_id=order.values("broker_id"),
        trading_env=order.values("trading_env"),
        trading_type=order.values("trading_type"),
        asset_id=order.values("asset_id"),
        order_side=order.values("order_side"),
        order_type=order.values("order_type"),
        order_creation_tmstmp=order.values("order_creation_tmstmp"),
        order_status="cancelled",
        fill_pct=order.values("fill_pct"),
        order_volume=order.values("order_volume"),
        order_price=order.values("order_price"),
        insert_tmstmp=dt.now(),
    )
    await sync_to_async(new_row.save)()
    return django.http.JsonResponse("success", safe=False)


async def get_orders(request: django.core.handlers.wsgi.WSGIRequest):
    exchange = request.GET.get("exchange")
    exchange = get_exchange_object(exchange, async_mode=True)
    orders = await exchange.fetch_orders(limit=3000)
    await exchange.close()
    for order in orders:
        order["broker_id"] = "coinbase"
        order["user_id"] = "thomasbouamoud"
        order["trading_env"] = "live"
        order["trading_type"] = "spot"
        order["order_id"] = order.pop("id")
        order["asset_id"] = order.pop("symbol")
        order["order_side"] = order.pop("side")
        order["order_type"] = order.pop("type")
        order["order_creation_tmstmp"] = order.pop("datetime")
        order["order_status"] = order.pop("status")
        order["fill_pct"] = order["filled"] / order["amount"]
        order["order_volume"] = order.pop("amount")
        order["order_price"] = order.pop("price")
        order["usd_value"] = round(order["order_volume"] * order["order_price"], 0)
        order["order_dim_key"] = order.pop("clientOrderId")
    return django.http.JsonResponse(orders, safe=False)


async def get_trades(request: django.core.handlers.wsgi.WSGIRequest):
    exchange = request.GET.get("exchange")
    exchange = get_exchange_object(exchange, async_mode=True)
    trades = await exchange.fetch_my_trades(limit=3000)
    await exchange.close()
    for trade in trades:
        trade["broker_id"] = "coinbase"
        trade["user_id"] = "thomasbouamoud"
        trade["trading_env"] = "live"
        trade["trading_type"] = "spot"
        trade["order_id"] = trade.pop("order")
        trade["trade_id"] = trade.pop("id")
        trade["asset_id"] = trade.pop("symbol")
        trade["trade_side"] = trade.pop("side")
        trade["execution_tmstmp"] = trade.pop("datetime")
        trade["trade_volume"] = trade.pop("amount")
        trade["trade_price"] = trade.pop("price")
    return django.http.JsonResponse(trades, safe=False)
