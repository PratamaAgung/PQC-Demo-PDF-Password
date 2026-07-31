# CUDA-Q GPU Worker for Grover's Algorithm
FROM nvidia/cuda:12.4.0-runtime-ubuntu22.04

WORKDIR /app

# Install Python and dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip curl \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir \
    fastapi==0.104.1 \
    uvicorn==0.24.0 \
    pikepdf==8.11.2 \
    numpy==1.26.4 \
    cuda-quantum==0.10.0

# Copy worker code
COPY worker.py .

EXPOSE 8001

CMD ["python3", "-m", "uvicorn", "worker:app", "--host", "0.0.0.0", "--port", "8001"]
