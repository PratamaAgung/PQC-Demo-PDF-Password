# Multi-stage build: Frontend + Backend in one container
# Stage 1: Build frontend
FROM node:18-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Runtime (SLIM CPU webapp image)
# This is the always-on webapp image deployed to ECS Express Mode. It does NOT
# install CUDA-Q, so it stays small. The app's GPU auto-detection degrades
# gracefully to CPU simulation when cudaq is absent.
# For the GPU-accelerated demo image (with cudaq) see Dockerfile.gpu.
# Pinned to linux/amd64 to match the ECS Express (Fargate x86_64) runtime.
FROM --platform=linux/amd64 python:3.11-slim
WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies (slim: no cudaq)
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend
COPY backend/ ./backend/

# Copy built frontend to nginx
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html

# Nginx config - serve frontend + proxy /api to backend
RUN rm /etc/nginx/sites-enabled/default
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create uploads directory
RUN mkdir -p /app/backend/uploads

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
  CMD curl -f http://localhost/api/health || exit 1

CMD ["sh", "-c", "cd /app/backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 & sleep 2 && nginx -g 'daemon off;'"]
