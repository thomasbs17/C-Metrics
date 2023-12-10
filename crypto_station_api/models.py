from django.db import models

ORDER_TYPES = (("limit", "Limit"), ("market", "Market"))
TRADING_ENV = (("paper_trading", "Paper Trading"), ("live", "Live"))
ORDER_STATUS = (("open", "Open"), ("executed", "Executed"), ("cancelled", "Cancelled"))
ORDER_SIDE = (("buy", "Buy"), ("sell", "Sell"))
ASSET_CLASS = (("crypto", "Crypto"), ("stock", "Stock"), ("bond", "Bond"))
TRADING_TYPE = (("spot", "Spot"), ("derivative", "Derivative"))


def get_option_max_len(options: tuple) -> int:
    all_strings = [item for sublist in options for item in sublist]
    return len(max(all_strings, key=len))


class Orders(models.Model):
    user_id = models.CharField("User ID", max_length=36)
    order_id = models.CharField("Order ID", max_length=36, primary_key=True)
    broker_id = models.CharField("Broker ID", max_length=36)
    trading_env = models.CharField(
        "Live or Paper Trading",
        max_length=get_option_max_len(TRADING_ENV),
        choices=TRADING_ENV,
    )
    trading_type = models.CharField(
        "Spot or Derivatives",
        max_length=get_option_max_len(TRADING_TYPE),
        choices=TRADING_TYPE,
    )
    asset_id = models.CharField("Asset ID", max_length=36)
    order_side = models.CharField(
        "Order Side", max_length=get_option_max_len(ORDER_SIDE), choices=ORDER_SIDE
    )
    order_type = models.CharField(
        "Order Type", max_length=get_option_max_len(ORDER_TYPES), choices=ORDER_TYPES
    )
    order_creation_tmstmp = models.DateTimeField("Order Creation Timestamp")
    order_status = models.CharField(
        "Order Status",
        max_length=get_option_max_len(ORDER_STATUS),
        choices=ORDER_STATUS,
    )
    fill_pct = models.FloatField("Fill Percentage")
    order_volume = models.FloatField("Order Volume")
    order_price = models.FloatField("Order Price")
    insert_tmstmp = models.DateTimeField("Record Insert Timestamp")
    expiration_tmstmp = models.DateTimeField("Record Expiration Timestamp", null=True)
