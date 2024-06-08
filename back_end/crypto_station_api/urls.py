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

import views

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
    path("latest_prices/", views.get_latest_prices, name="latest_prices"),
    path("order_book/", views.get_order_book, name="order_book"),
    path("news/", views.get_news, name="news"),
    path("orders/", views.get_orders, name="orders"),
    path("trades/", views.get_trades, name="trades"),
    path("new_order/", views.post_new_order, name="new_order"),
    path("cancel_order/", views.cancel_order, name="cancel_order"),
    path("log_in/", views.login_view, name="log_in"),
]
