#!/bin/bash
set -e

# Start backend
cd /app/backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 &

# Wait for backend to be ready
sleep 2

# Start nginx (foreground)
nginx -g "daemon off;"
