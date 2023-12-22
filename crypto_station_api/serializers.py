from rest_framework import serializers

from .models import Orders, Trades


class OrdersSerializer(serializers.ModelSerializer):
    class Meta:
        model = Orders
        fields = "__all__"


class TradesSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trades
        fields = "__all__"
