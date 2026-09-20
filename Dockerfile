# Multi-stage production container for Owais Anime Stream (Python + Node.js WASM)
FROM python:3.11-slim

# Install system dependencies, curl, and Node.js for WASM token decryption
RUN apt-get update && apt-get install -y --no-install-recommends \
    nodejs \
    npm \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Node.js requirements
COPY node/package.json node/package.json
RUN cd node && npm install --omit=dev

# Copy application source code
COPY . .

# Set environment defaults
ENV PYTHONUNBUFFERED=1 \
    PORT=8000

EXPOSE 8000

# Start FastAPI application
CMD ["sh", "-c", "uvicorn reanime.app:app --host 0.0.0.0 --port ${PORT:-8000}"]
