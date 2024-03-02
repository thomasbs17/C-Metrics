import uuid
from datetime import datetime as dt

import ccxt
from GoogleNews import GoogleNews
from asgiref.sync import sync_to_async
from ccxt.base import errors
from django.http import JsonResponse
from rest_framework import viewsets
from rest_framework.decorators import api_view
from rest_framework.parsers import JSONParser
from rest_framework.renderers import JSONRenderer
from rest_framework.views import APIView

from crypto_station_api.data_sources.coinmarketcap import CoinMarketCap
from crypto_station_api.models import Orders, Trades
from crypto_station_api.serializers import OrdersSerializer, TradesSerializer
from utils.helpers import get_exchange_object

coinmarketcap = CoinMarketCap()


class SimpleJSONView(APIView):
    parser_classes = [JSONParser]
    renderer_classes = [JSONRenderer]


def get_exchanges(request):
    data = ccxt.exchanges
    return JsonResponse(data, safe=False)


@sync_to_async
@api_view(["GET"])
def get_ohlc(request):
    exchange = request.query_params.get("exchange")
    timeframe = request.query_params.get("timeframe")
    pair = request.query_params.get("pair")
    exchange = get_exchange_object(exchange, async_mode=False)
    try:
        ohlc_data = exchange.fetch_ohlcv(symbol=pair, timeframe=timeframe, limit=300)
        return JsonResponse(ohlc_data, safe=False)
    except errors.BadSymbol:
        return JsonResponse(None, safe=False)


@sync_to_async
@api_view(["GET"])
def get_order_book(request):
    exchange = request.query_params.get("exchange")
    pair = request.query_params.get("pair")
    exchange = get_exchange_object(exchange, async_mode=False)
    try:
        order_book_data = exchange.fetch_order_book(symbol=pair, limit=10000)
        return JsonResponse(order_book_data, safe=False)
    except errors.BadSymbol:
        return JsonResponse(None, safe=False)


@sync_to_async
@api_view(["GET"])
def get_asset_coinmarketcap_mapping(request):
    return JsonResponse(
        coinmarketcap.get_endpoint(
            api_version=1, category="cryptocurrency", endpoint="map"
        ),
        safe=False,
    )


@sync_to_async
@api_view(["GET"])
def get_crypto_meta_data(request):
    crypto_coinmarketcap_id = request.query_params.get("crypto_coinmarketcap_id")
    return JsonResponse(
        coinmarketcap.get_endpoint(
            api_version=2,
            category="cryptocurrency",
            endpoint=f"info?id={crypto_coinmarketcap_id}",
        ),
        safe=False,
    )


@sync_to_async
@api_view(["GET"])
def get_exchange_markets(request):
    exchange = request.query_params.get("exchange")
    exchange = get_exchange_object(exchange, async_mode=False)
    return JsonResponse(exchange.load_markets(), safe=False)


@sync_to_async
@api_view(["GET"])
def get_news(request):
    pair = request.query_params.get("search_term")
    googlenews = GoogleNews()
    googlenews.get_news(pair)
    data = googlenews.results()
    data = [
        article
        for article in data
        if isinstance(article["datetime"], dt) and article["datetime"] <= dt.now()
    ]
    return JsonResponse(data, safe=False)


@sync_to_async
@api_view(["GET"])
def get_public_trades(request):
    exchange = request.query_params.get("exchange")
    pair = request.query_params.get("pair")
    exchange = get_exchange_object(exchange, async_mode=False)
    try:
        data = exchange.fetch_trades(symbol=pair, limit=1000)
        return JsonResponse(data, safe=False)
    except errors.BadSymbol:
        return JsonResponse(None, safe=False)


@sync_to_async
@api_view(["POST"])
def post_new_order(request):
    new_order = Orders(
        order_dim_key=str(uuid.uuid4()),
        user_id=request.data["user_id"],
        order_id=str(uuid.uuid4()),
        broker_id=request.data["broker_id"],
        trading_env=request.data["trading_env"],
        trading_type=request.data["trading_type"],
        asset_id=request.data["asset_id"],
        order_side=request.data["order_side"],
        order_type=request.data["order_type"],
        order_creation_tmstmp=dt.fromtimestamp(
            float(request.data["order_creation_tmstmp"]) / 1000
        ),
        order_status=request.data["order_status"],
        fill_pct=request.data["fill_pct"],
        order_volume=request.data["order_volume"],
        order_price=request.data["order_price"] if request.data["order_price"] else 1,
        insert_tmstmp=dt.now(),
    )
    new_order.save()
    return JsonResponse("success", safe=False)


class OrdersViewSet(viewsets.ModelViewSet):
    queryset = Orders.objects.all()
    serializer_class = OrdersSerializer

    def get_queryset(self):
        return Orders.objects.filter(expiration_tmstmp__isnull=True)


class TradesViewSet(viewsets.ModelViewSet):
    queryset = Trades.objects.all()
    serializer_class = TradesSerializer

    def get_queryset(self):
        return Trades.objects.filter(expiration_tmstmp__isnull=True)
