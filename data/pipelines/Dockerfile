FROM python:3.12-slim

WORKDIR /pipelines

RUN apt-get update && apt-get install -y \
    libpq-dev gcc git \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV DAGSTER_HOME=/dagster_home
RUN mkdir -p /dagster_home

EXPOSE 3001

CMD ["dagster-webserver", "-h", "0.0.0.0", "-p", "3001", "-f", "definitions.py"]
