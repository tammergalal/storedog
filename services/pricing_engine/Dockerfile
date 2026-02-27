FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends wait-for-it && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# H9: run as non-root for better container security
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser
# S2: lightweight health check so orchestrators know when the service is ready
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8002/health')"
CMD ["ddtrace-run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]
