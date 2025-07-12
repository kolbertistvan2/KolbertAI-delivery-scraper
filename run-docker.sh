#!/bin/bash

set -e

IMAGE_NAME="kolbertai-shipping-extractor"

# Build the Docker image

echo "[INFO] Building Docker image..."
docker build -t $IMAGE_NAME .

echo "[INFO] Running Docker container..."
docker run --rm --name kolbertai-shipping-extractor \
  -e GOOGLE_API_KEY="$GOOGLE_API_KEY" \
  -e BROWSERBASE_API_KEY="$BROWSERBASE_API_KEY" \
  -e BROWSERBASE_PROJECT_ID="$BROWSERBASE_PROJECT_ID" \
  -e BATCH_SIZE="$BATCH_SIZE" \
  -v "$(pwd)/result:/app/result" \
  -v "$(pwd)/websites.txt:/app/websites.txt" \
  -v "$(pwd)/prompt.txt:/app/prompt.txt" \
  $IMAGE_NAME 