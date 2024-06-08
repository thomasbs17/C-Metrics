FROM python:3.10-slim-bullseye 

WORKDIR /app
COPY . /app

ENV PYTHONUNBUFFERED=1

RUN pip install --upgrade pip
RUN pip install -r requirements.txt

EXPOSE 8000
CMD python manage.py runserver 0.0.0.0:8000 # FOR DEBUG
# CMD daphne -b 0.0.0.0 -p 8000 cmetrics.backend.asgi:application