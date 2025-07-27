#!/bin/bash

# KolbertAI Delivery Scraper - V2 Batch Processing
# This script processes multiple domains using the V2 extraction logic

set -e

echo "🚀 Starting KolbertAI Delivery Scraper V2 Batch Processing..."

# Set default batch size if not provided
BATCH_SIZE=${BATCH_SIZE:-1}
echo "📊 Batch size: $BATCH_SIZE (domains processed in parallel)"

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

# Read domains into array
echo "📋 Reading domains from websites.txt..."
domains=()
while IFS= read -r domain; do
    # Skip empty lines and comments
    if [[ -z "$domain" || "$domain" =~ ^[[:space:]]*# ]]; then
        continue
    fi
    
    # Clean domain (remove whitespace, http/https, www)
    domain=$(echo "$domain" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | sed 's|^https\?://||' | sed 's|^www\.||')
    domains+=("$domain")
done < websites.txt

total_domains=${#domains[@]}
echo "📊 Total domains to process: $total_domains"

# Process domains in batches
successful_count=0
failed_count=0

for ((i=0; i<total_domains; i+=BATCH_SIZE)); do
    batch_start=$i
    batch_end=$((i + BATCH_SIZE - 1))
    if [ $batch_end -ge $total_domains ]; then
        batch_end=$((total_domains - 1))
    fi
    
    echo "🔄 Processing batch $((i/BATCH_SIZE + 1)): domains $((batch_start + 1))-$((batch_end + 1))"
    
    # Array to store background job PIDs
    pids=()
    
    # Start parallel processing for this batch
    for ((j=batch_start; j<=batch_end; j++)); do
        domain=${domains[j]}
        echo "🌐 Starting: $domain"
        
        # Run Docker container for this domain in background
        docker run --env-file .env -v "$(pwd)/result-returns-v2:/app/result-returns-v2" kolbertai-delivery-scraper "$domain" &
        pids+=($!)
    done
    
    # Wait for all background jobs in this batch to complete
    echo "⏳ Waiting for batch $((i/BATCH_SIZE + 1)) to complete..."
    for pid in "${pids[@]}"; do
        if wait $pid; then
            ((successful_count++))
        else
            ((failed_count++))
        fi
    done
    
    echo "✅ Batch $((i/BATCH_SIZE + 1)) completed"
    
    # Wait between batches to avoid overwhelming the system
    if [ $((i + BATCH_SIZE)) -lt $total_domains ]; then
        echo "⏳ Waiting 5 seconds before next batch..."
        sleep 5
    fi
done

# Aggregate results
echo "📊 Aggregating results..."
if docker run --env-file .env -v "$(pwd)/result-returns-v2:/app/result-returns-v2" kolbertai-delivery-scraper aggregate; then
    echo "✅ Results aggregated successfully"
else
    echo "❌ Failed to aggregate results"
fi

# Summary
echo ""
echo "🎉 Batch processing completed!"
echo "✅ Successful: $successful_count"
echo "❌ Failed: $failed_count"
echo "📁 Results saved in: result-returns-v2/"
echo ""
echo "📋 Individual files:"
ls -la result-returns-v2/return-info-*.json 2>/dev/null || echo "No individual result files found"
echo ""
echo "📊 Aggregated file:"
ls -la result-returns-v2/return-info-ALL-SITES-*.json 2>/dev/null || echo "No aggregated file found"
