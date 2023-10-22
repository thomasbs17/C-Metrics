"""
URL configuration for test project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path

from crypto_station_api.views import (
    OrdersViewSet,
    get_exchanges,
    get_ohlc,
    get_order_book,
    get_exchange_markets,
    get_news,
    get_public_trades,
    post_new_order, get_asset_coinmarketcap_mapping,
)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("exchanges/", get_exchanges, name="all_exchanges"),
    path("coinmarketcap_info/", get_asset_coinmarketcap_mapping, name="coin_market_cap_info"),
    path("markets/", get_exchange_markets, name="exchange_markets"),
    path("ohlc/", get_ohlc, name="get_ohlc"),
    path("order_book/", get_order_book, name="order_book"),
    path("public_trades/", get_public_trades, name="public_trades"),
    path("news/", get_news, name="news"),
    path("orders/", OrdersViewSet.as_view({"get": "list"}), name="orders"),
    path("new_order/", post_new_order, name="new_order"),
]
