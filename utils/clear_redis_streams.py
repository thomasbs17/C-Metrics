import asyncio
import redis.asyncio as async_redis
import helpers


async def clear_streams():
    redis_host = helpers.HOST
    redis_port = helpers.REDIS_PORT
    redis_client = async_redis.StrictRedis(
        host=redis_host, port=redis_port, decode_responses=True
    )
    streams = await helpers.get_available_redis_streams(redis_client)
    for stream in streams:
        await redis_client.delete(stream)
        print(f"Cleared {stream} stream")


asyncio.run(clear_streams())
