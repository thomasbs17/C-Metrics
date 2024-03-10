import json
import time
from datetime import datetime as dt

from channels.generic.websocket import WebsocketConsumer


class ChatConsumer(WebsocketConsumer):
    def connect(self):
        self.accept()
        while True:
            self.send(text_data=json.dumps({"message": dt.now().strftime("%H:%M:%S")}))
            time.sleep(1)

    def disconnect(self, close_code):
        pass

    def receive(self, text_data=None):
        text_data_json = json.loads(text_data)
        message = text_data_json["message"]
        self.send(text_data=json.dumps({"message": message}))
