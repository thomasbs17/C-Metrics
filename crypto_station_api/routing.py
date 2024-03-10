from django.contrib import admin
from django.urls import path

from crypto_station_api import views, consumers

urlpatterns = [
    path("admin/", admin.site.urls),
    path("exchanges/", views.get_exchanges, name="all_exchanges"),
    path(
        "coinmarketcap_info/",
        views.get_asset_coinmarketcap_mapping,
        name="coin_market_cap_info",
    ),
    path(
        "coinmarketcap_crypto_meta/",
        views.get_crypto_meta_data,
        name="coin_market_cap_crypto_meta",
    ),
    path("markets/", views.get_exchange_markets, name="exchange_markets"),
    path("ohlc/", views.get_ohlc, name="get_ohlc"),
    path("order_book/", views.get_order_book, name="order_book"),
    path("public_trades/", views.get_public_trades, name="public_trades"),
    path("news/", views.get_news, name="news"),
    path("orders/", views.OrdersViewSet.as_view({"get": "list"}), name="orders"),
    path("trades/", views.TradesViewSet.as_view({"get": "list"}), name="trades"),
    path("new_order/", views.post_new_order, name="new_order"),
    path("cancel_order/", views.cancel_order, name="cancel_order"),
]

websocket_urlpatterns = [
    path("ws/live_data/", consumers.PublicLiveDataStream.as_asgi()),
]
