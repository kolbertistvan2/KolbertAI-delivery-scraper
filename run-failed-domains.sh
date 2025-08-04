#!/bin/bash

# KolbertAI Delivery Scraper - Failed Domains Retry Script
# This script processes only failed domains with smaller batch size

set -e

echo "🔄 Starting Failed Domains Retry Processing..."

# Set default batch size for failed domains (smaller for stability)
BATCH_SIZE=${BATCH_SIZE:-3}
echo "📊 Batch size: $BATCH_SIZE (domains processed in parallel)"

# Check if failed-domains.txt exists
if [ ! -f failed-domains.txt ]; then
    echo "❌ Error: failed-domains.txt not found!"
    echo "Please run ./extract-failed-domains.sh first to generate the failed domains list."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create a .env file with your API keys:"
    echo "BROWSERBASE_API_KEY=your_key_here"
    echo "BROWSERBASE_PROJECT_ID=your_project_id_here"
    echo "GOOGLE_API_KEY=your_google_key_here"
    exit 1
fi

# Build Docker image
echo "🔨 Building Docker image..."
docker build -t kolbertai-delivery-scraper .

# Create result directory
mkdir -p result-returns-v2

# Read failed domains into array
echo "📋 Reading failed domains from failed-domains.txt..."
failed_domains=()
while IFS= read -r domain; do
    # Skip empty lines and comments
    if [[ -z "$domain" || "$domain" =~ ^[[:space:]]*# ]]; then
        continue
    fi
    
    # Clean domain (remove whitespace, http/https, www, and everything after /)
    domain=$(echo "$domain" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | sed 's|^https\?://||' | sed 's|^www\.||' | sed 's|/.*$||')
    failed_domains+=("$domain")
done < failed-domains.txt

total_failed_domains=${#failed_domains[@]}
echo "📊 Total failed domains to retry: $total_failed_domains"

# Process failed domains in batches
successful_count=0
failed_count=0

for ((i=0; i<total_failed_domains; i+=BATCH_SIZE)); do
    batch_start=$i
    batch_end=$((i + BATCH_SIZE - 1))
    if [ $batch_end -ge $total_failed_domains ]; then
        batch_end=$((total_failed_domains - 1))
    fi
    
    echo "🔄 Processing failed batch $((i/BATCH_SIZE + 1)): domains $((batch_start + 1))-$((batch_end + 1))"
    
    # Array to store background job PIDs
    pids=()
    
    # Start parallel processing for this batch
    for ((j=batch_start; j<=batch_end; j++)); do
        domain=${failed_domains[j]}
        echo "🌐 Retrying: $domain"
        
        # Run Docker container for this domain in background
        docker run --env-file .env -v "$(pwd)/result-returns-v2:/app/result-returns-v2" kolbertai-delivery-scraper "$domain" &
        pids+=($!)
    done
    
    # Wait for all background jobs in this batch to complete
    echo "⏳ Waiting for failed batch $((i/BATCH_SIZE + 1)) to complete..."
    for pid in "${pids[@]}"; do
        if wait $pid; then
            ((successful_count++))
        else
            ((failed_count++))
        fi
    done
    
    echo "✅ Failed batch $((i/BATCH_SIZE + 1)) completed"
    
    # Wait longer between batches for failed domains
    if [ $((i + BATCH_SIZE)) -lt $total_failed_domains ]; then
        echo "⏳ Waiting 10 seconds before next failed batch..."
        sleep 10
    fi
done

# Aggregate results (this will update the ALL-SITES file without duplicates)
echo "📊 Aggregating results..."
if docker run --env-file .env -v "$(pwd)/result-returns-v2:/app/result-returns-v2" kolbertai-delivery-scraper aggregate; then
    echo "✅ Results aggregated successfully"
    echo "📈 Retry Summary:"
    echo "✅ Successfully retried: $successful_count"
    echo "❌ Still failed: $failed_count"
    echo "📊 Retry success rate: $((successful_count * 100 / total_failed_domains))%"
else
    echo "❌ Failed to aggregate results"
fi

echo "🎉 Failed domains retry processing completed!" 