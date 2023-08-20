#!/bin/bash
cd 'C:\Users\Thomas Bouamoud\Code\crypto_station_front_end'
source 'venv/Scripts/activate'
python manage.py runserver &
cd front_end
npm start
/bin/bash