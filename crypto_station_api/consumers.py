import asyncio
import json
import logging
import os
import sys

import redis.asyncio as async_redis

from channels import exceptions
from channels.generic.websocket import AsyncWebsocketConsumer

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../")))

from utils import helpers

LOG = logging.getLogger(__name__)


class PublicLiveDataStream(AsyncWebsocketConsumer):
    """
    Exposes data on: ws://127.0.0.1:8000/ws/live_data/?pairs=EXCHANGE-BASE-QUOTE
    """

    async def connect(self):
        self.redis_server = async_redis.StrictRedis(
            host=helpers.HOST, port=helpers.REDIS_PORT, decode_responses=True
        )
        self.errors = list()
        self.client_parmas = await self.get_client_params()
        self.client_streams = await self.get_valid_channels()
        if self.client_streams:
            await self.accept()
            if self.errors:
                await self.send(text_data=json.dumps({"errors": self.errors}))
            await self.serve_client_data()
        else:
            await self.close()
            raise exceptions.StopConsumer()

    async def get_client_params(self) -> dict:
        parmas = dict()
        raw_params = self.scope["query_string"].decode("utf-8")
        for raw_param in raw_params.split("&"):
            try:
                k, v = raw_param.split("=")
                parmas[k] = v
            except ValueError:
                pass
        return parmas

    async def serve_client_data(self):
        while True:
            streams = {stream: "$" for stream in self.client_streams}
            data = await self.redis_server.xread(streams=streams, block=0)
            data = data[0][1]
            _, latest_record = data[len(data) - 1]
            await self.send(text_data=json.dumps(latest_record))
            asyncio.sleep(0)

    async def get_valid_channels(self) -> list:
        methods = ["trades", "book"]
        client_channels = list()
        validated_channels = list()
        failed_channels = list()
        streams = await helpers.get_available_redis_streams(self.redis_server)
        if not streams:
            LOG.error("The real time service is down")
        else:
            client_pairs = self.client_parmas.get("pairs", "").split(",")
            for pair in client_pairs:
                for method in methods:
                    client_channels.append(f"{method}-{pair}")
            for channel in client_channels:
                (
                    validated_channels.append(channel)
                    if channel in streams
                    else failed_channels.append(channel)
                )
            if failed_channels:
                log = f'Following channels are invalid: {", ".join(failed_channels)}'
                LOG.error(log)
                self.errors.append(log)
        return validated_channels

    async def disconnect(self, close_code):
        raise exceptions.StopConsumer()

    async def receive(self, text_data=None):
        pass


class PrivateOrderStream(AsyncWebsocketConsumer):
    """
    Exposes data on: ws://127.0.0.1:8000/ws/orders/
    """

    async def connect(self):
        self.redis_server = async_redis.StrictRedis(
            host=helpers.HOST, port=helpers.REDIS_PORT, decode_responses=True
        )
        await self.accept()  # TODO: implement authorization
        await self.serve_client_data()

    async def disconnect(self, close_code):
        pass

    async def receive(self, text_data=None):
        pass
