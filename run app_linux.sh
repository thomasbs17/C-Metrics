# !/bin/bash
sudo fuser -k 8000/tcp
sudo fuser -k 8765/tcp
sudo fuser -k 8766/tcp
sudo fuser -k 8767/tcp
sudo fuser -k 8768/tcp


source 'venv/bin/activate'
sudo systemctl enable redis-server &
sudo systemctl start redis-server &
python3 manage.py runserver &
python3 '.\services\screening\main.py' &
python3 services/market_data_aggregator/real-time-data.py &
cd front_end
npm start
# /bin/bash