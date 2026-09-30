FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    VIBE_TRADING_RUNTIME_DIR=/data

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl libcairo2 libpango-1.0-0 libpangoft2-1.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 8899
CMD ["sh", "-c", "vibe-trading serve --host 0.0.0.0 --port ${PORT:-8899}"]
