#!/bin/bash
source 'venv/bin/activate'
python3 manage.py runserver &
python3 crypto_station_api/real-time-data.py &
cd front_end
npm install
npm start
/bin/bash