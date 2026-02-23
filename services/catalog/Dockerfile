FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends wait-for-it && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV DD_SERVICE=store-catalog
ENV DD_ENV=production
ENV DD_VERSION=1.0.0
ENV DD_TRACE_PROPAGATION_STYLE=datadog,tracecontext
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"
CMD ["ddtrace-run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
