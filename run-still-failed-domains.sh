#!/bin/bash

# KolbertAI Delivery Scraper - Still Failed Domains Retry Script
# This script processes only the domains that are still failing after previous retries

set -e

echo "🔄 Starting Still Failed Domains Retry Processing..."

# Set very conservative batch size for still failed domains
BATCH_SIZE=${BATCH_SIZE:-1}
echo "📊 Batch size: $BATCH_SIZE (domains processed one by one for maximum stability)"

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
echo "📋 Reading still failed domains from failed-domains.txt..."
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
echo "📊 Total still failed domains to retry: $total_failed_domains"

# Process failed domains one by one (very conservative approach)
successful_count=0
failed_count=0

for ((i=0; i<total_failed_domains; i++)); do
    domain=${failed_domains[i]}
    echo "🌐 Processing still failed domain $((i+1))/$total_failed_domains: $domain"
    
    # Run Docker container for this domain
    if docker run --env-file .env -v "$(pwd)/result-returns-v2:/app/result-returns-v2" kolbertai-delivery-scraper "$domain"; then
        ((successful_count++))
        echo "✅ Successfully processed: $domain"
    else
        ((failed_count++))
        echo "❌ Still failed: $domain"
    fi
    
    # Wait longer between domains for still failed ones
    if [ $((i + 1)) -lt $total_failed_domains ]; then
        echo "⏳ Waiting 15 seconds before next still failed domain..."
        sleep 15
    fi
done

# Aggregate results
echo "📊 Aggregating results..."
if docker run --env-file .env -v "$(pwd)/result-returns-v2:/app/result-returns-v2" kolbertai-delivery-scraper aggregate; then
    echo "✅ Results aggregated successfully"
    echo "📈 Still Failed Retry Summary:" 
    echo "✅ Successfully retried: $successful_count"
    echo "❌ Still failed: $failed_count"
    echo "📊 Retry success rate: $((successful_count * 100 / total_failed_domains))%"
else
    echo "❌ Failed to aggregate results"
fi

echo "🎉 Still failed domains retry processing completed!" 