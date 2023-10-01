import datetime
import uuid
import ccxt
from GoogleNews import GoogleNews
from django.http import JsonResponse
from rest_framework.decorators import api_view
from rest_framework.parsers import JSONParser
from rest_framework.renderers import JSONRenderer
from rest_framework.views import APIView
from rest_framework import viewsets

from crypto_station_api.models import Orders
from crypto_station_api.serializers import OrdersSerializer


class SimpleJSONView(APIView):
    parser_classes = [JSONParser]
    renderer_classes = [JSONRenderer]


def get_exchanges(request):
    data = ccxt.exchanges
    return JsonResponse(data, safe=False)


@api_view(["GET"])
def get_ohlc(request):
    exchange = request.query_params.get("exchange")
    pair = request.query_params.get("pair")
    exchange_class = getattr(ccxt, exchange)
    exchange = exchange_class()
    ohlc_data = exchange.fetch_ohlcv(symbol=pair, timeframe="1d", limit=300)
    return JsonResponse(ohlc_data, safe=False)


@api_view(["GET"])
def get_order_book(request):
    exchange = request.query_params.get("exchange")
    pair = request.query_params.get("pair")
    exchange_class = getattr(ccxt, exchange)
    exchange = exchange_class()
    order_book_data = exchange.fetch_order_book(symbol=pair, limit=1000)
    return JsonResponse(order_book_data, safe=False)


@api_view(["GET"])
def get_markets(request):
    exchange = request.query_params.get("exchange")
    exchange_class = getattr(ccxt, exchange)
    exchange = exchange_class()
    return JsonResponse(exchange.load_markets(), safe=False)


@api_view(["GET"])
def get_news(request):
    pair = request.query_params.get("pair")
    googlenews = GoogleNews()
    googlenews.get_news(pair)
    data = googlenews.results()
    return JsonResponse(data, safe=False)


@api_view(["GET"])
def get_public_trades(request):
    exchange = request.query_params.get("exchange")
    pair = request.query_params.get("pair")
    exchange_class = getattr(ccxt, exchange)
    exchange = exchange_class()
    data = exchange.fetch_trades(symbol=pair, limit=1000)
    return JsonResponse(data, safe=False)


@api_view(["POST"])
def post_new_order(request):
    new_order = Orders(
        user_id=request.data["user_id"],
        order_id=str(uuid.uuid4()),
        broker_id=request.data["broker_id"],
        trading_env=request.data["trading_env"],
        trading_type=request.data["trading_type"],
        asset_id=request.data["asset_id"],
        order_side=request.data["order_side"],
        order_type=request.data["order_type"],
        order_creation_tmstmp=datetime.datetime.fromtimestamp(
            float(request.data["order_creation_tmstmp"]) / 1000
        ),
        order_status=request.data["order_status"],
        fill_pct=request.data["fill_pct"],
        order_volume=request.data["order_volume"],
        order_price= request.data["order_price"] if request.data["order_price"] else 1,
    )
    new_order.save()
    return JsonResponse("success", safe=False)


class OrdersViewSet(viewsets.ModelViewSet):
    queryset = Orders.objects.all()
    serializer_class = OrdersSerializer
