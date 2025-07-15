#!/bin/bash

WEBSITES_FILE="websites.txt"
IMAGE="kolbertai-shipping-extractor:latest"
RESULT_DIR="$(pwd)/result-returns"
MAX_RETRIES=3
BATCH_SIZE=${BATCH_SIZE:-1}
TIMEOUT_PER_DOMAIN=10m

# Timeout parancs detektálása (macOS: gtimeout, Linux: timeout)
if command -v timeout >/dev/null 2>&1; then
  TIMEOUT_CMD="timeout"
elif command -v gtimeout >/dev/null 2>&1; then
  TIMEOUT_CMD="gtimeout"
else
  echo "HIBA: timeout (vagy gtimeout) parancs nem található! Telepítsd: brew install coreutils"
  exit 1
fi

if [ ! -f "$WEBSITES_FILE" ]; then
  echo "websites.txt not found!"
  exit 1
fi

mkdir -p "$RESULT_DIR"

domains=()
while IFS= read -r line; do
  domain=$(echo "$line" | xargs)
  if [ -n "$domain" ]; then
    domains+=("$domain")
  fi
done < "$WEBSITES_FILE"

total=${#domains[@]}
echo "Processing $total domains with batch size $BATCH_SIZE using prompt-return.txt"

# Process domains in batches
for ((i=0; i<total; i+=BATCH_SIZE)); do
  batch=("${domains[@]:i:BATCH_SIZE}")
  echo "Processing batch: ${batch[*]}"

  # Start all domains in current batch in parallel
  pids=()
  for domain in "${batch[@]}"; do
    result_file="$RESULT_DIR/return-info-$domain"
    if ls "$result_file"*.json 1> /dev/null 2>&1; then
      echo "Skipping $domain: result already exists."
      continue
    fi

    (
      attempt=1
      while [ $attempt -le $MAX_RETRIES ]; do
        echo "[${domain}] Attempt $attempt of $MAX_RETRIES"
        $TIMEOUT_CMD $TIMEOUT_PER_DOMAIN docker run --rm --env-file .env -v "$RESULT_DIR:/app/result-returns" $IMAGE npx tsx extract-returns.ts "$domain"
        exit_code=$?
        if [ $exit_code -eq 0 ]; then
          echo "[${domain}] Success."
          break
        else
          echo "[${domain}] Failed (exit code $exit_code)."
          if [ $attempt -eq $MAX_RETRIES ]; then
            echo "[${domain}] Failed after $MAX_RETRIES attempts." | tee "$RESULT_DIR/failed-$domain-$(date +%Y%m%d%H%M%S).log"
          fi
          attempt=$((attempt+1))
          sleep 2
        fi
      done
    ) &
    pids+=($!)
  done

  # Wait for all processes in current batch to complete
  for pid in "${pids[@]}"; do
    wait $pid
  done

done

echo "All domains processed using prompt-return.txt."

# Batch summary
success_count=$(ls $RESULT_DIR/return-info-*.json 2>/dev/null | wc -l)
fail_count=$(ls $RESULT_DIR/failed-*.log 2>/dev/null | wc -l)
echo ""
echo "Batch summary:"
echo "  Sikeres: $success_count"
echo "  Hibás:   $fail_count"
if [ $fail_count -gt 0 ]; then
  echo "Hibás domainek:"
  for f in $RESULT_DIR/failed-*.log; do
    [ -e "$f" ] || continue
    domain=$(basename "$f" | sed 's/failed-\(.*\)-[0-9T:-]*.log/\1/')
    echo "  $domain"
  done
fi

exit 0 