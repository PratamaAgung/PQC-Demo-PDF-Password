# CUDA-Q GPU Worker for Grover's Algorithm
FROM nvcr.io/nvidia/cuda-quantum:0.11.0

WORKDIR /app

# Install Python dependencies
RUN pip install --no-cache-dir \
    fastapi==0.104.1 \
    uvicorn==0.24.0 \
    pikepdf==8.11.2 \
    numpy==1.26.4

# Copy worker code
COPY worker.py .

EXPOSE 8001

CMD ["python", "-m", "uvicorn", "worker:app", "--host", "0.0.0.0", "--port", "8001"]
