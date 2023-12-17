# !/bin/bash
# RESET PORTS ################################################################################
sudo fuser -k 8000/tcp
sudo fuser -k 8765/tcp
sudo fuser -k 8766/tcp
sudo fuser -k 8767/tcp
sudo fuser -k 8768/tcp

# BACK-END ####################################################################################
source 'venv/bin/activate'
sudo systemctl enable redis-server &
sudo systemctl start redis-server &
python3 manage.py runserver &

# RUN SERVICES
python3 '.\services\order_execution\main.py' &
python3 '.\services\screening\main.py' &
python3 services/market_data_aggregator/real-time-data.py &

# FRONT-END ####################################################################################
cd front_end
npm start

################################################################################################
# /bin/bash