#!/bin/bash

echo "🔍 Extracting failed domains from log files..."

# Create failed-domains.txt with unique failed domains (clean domain names only)
ls result-returns-v2/failed-*.log | sed 's/.*failed-//' | sed 's/-[0-9].*\.log//' | sort | uniq > failed-domains.txt

# Count failed domains
FAILED_COUNT=$(wc -l < failed-domains.txt)
SUCCESS_COUNT=$(ls result-returns-v2/return-info-*.json | wc -l)
TOTAL_COUNT=$((FAILED_COUNT + SUCCESS_COUNT))

echo "📊 Results Summary:"
echo "✅ Successful domains: $SUCCESS_COUNT"
echo "❌ Failed domains: $FAILED_COUNT"
echo "📈 Total domains: $TOTAL_COUNT"
echo "📊 Success rate: $((SUCCESS_COUNT * 100 / TOTAL_COUNT))%"

echo ""
echo "📝 Failed domains saved to: failed-domains.txt"
echo "🔢 Total failed domains: $FAILED_COUNT"

# Show first 10 failed domains
echo ""
echo "📋 First 10 failed domains:"
head -10 failed-domains.txt

echo ""
echo "🚀 To retry failed domains, run:"
echo "BATCH_SIZE=3 ./run-failed-domains.sh" 