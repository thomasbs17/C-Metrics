import json
import pickle
import ccxt
import redis

REDIS_CLIENT = redis.StrictRedis(host='localhost', port=6379, decode_responses=True)

def test():
    data = dict()
    if not REDIS_CLIENT.exists('all_markets'):
        data = REDIS_CLIENT.get('all_markets')
        data = json.loads(data)
    else:    
        exchanges = ccxt.exchanges
        for exchange in exchanges:
            exchange_class = getattr(ccxt, exchange)
            exchange_object = exchange_class()
            data[exchange] = exchange_object.load_markets()
            REDIS_CLIENT.set('all_markets', json.dumps(data))

test()