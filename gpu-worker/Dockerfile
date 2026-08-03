# GPU Worker for Grover's Algorithm using CUDA-Q
# Must be built on Linux x86_64 (use CI or --platform linux/amd64)
FROM --platform=linux/amd64 python:3.11-slim

WORKDIR /app

# Install system deps required by cuda-quantum
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    libstdc++6 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy worker code
COPY worker.py .

EXPOSE 8001

CMD ["python", "-m", "uvicorn", "worker:app", "--host", "0.0.0.0", "--port", "8001"]
