# Multi-Machine Workflow Documentation

## Overview
This document describes how to handle return information extraction across multiple machines and merge the results.

## Workflow Steps

### 1. Initial Setup (First Machine)
```bash
# Clone repository
git clone https://github.com/kolbertistvan2/KolbertAI-delivery-scraper.git
cd KolbertAI-delivery-scraper

# Setup environment
cp .env.example .env
# Edit .env with your API keys

# Build Docker image
docker build -t kolbertai-shipping-extractor .

# Run extraction for first country
./run-returns-batches.sh
```

### 2. Processing on Additional Machines

#### 2.1 Fresh Setup (New Machine)
```bash
# Clone repository
git clone https://github.com/kolbertistvan2/KolbertAI-delivery-scraper.git
cd KolbertAI-delivery-scraper

# Setup environment
cp .env.example .env
# Edit .env with your API keys

# Build Docker image
docker build -t kolbertai-shipping-extractor .

# Update websites.txt for your country
# Edit websites.txt with domains for your target country

# Run extraction
./run-returns-batches.sh
```

#### 2.2 Existing Setup (Machine with Previous Results)
```bash
# Pull latest changes
git pull origin main

# Update environment if needed
# Check if .env has correct API keys

# Run extraction for new country
./run-returns-batches.sh
```

### 3. Merging Results from Multiple Machines

#### 3.1 Copy Results to Main Machine
```bash
# On machine with new results
# Copy result-returns-v2/ folder to main machine
# You can use scp, rsync, or any file transfer method

# Example with scp:
scp -r result-returns-v2/ user@main-machine:/path/to/KolbertAI-delivery-scraper/
```

#### 3.2 Merge and Aggregate on Main Machine
```bash
# On main machine
cd KolbertAI-delivery-scraper

# Pull latest code changes
git pull origin main

# Run final aggregation (this will deduplicate and merge all results)
npx tsx aggregate-final-returns.ts
```

### 4. Aggregation Process Details

The `aggregate-final-returns.ts` script will:

1. **Read all JSON files** from `result-returns-v2/`
2. **Deduplicate domains** based on:
   - Domain normalization (remove www., https://, etc.)
   - Data quality scoring
   - Presence in `websites.txt`
3. **Maintain order** from `websites.txt`
4. **Clean JSON structure** to match prompt format exactly
5. **Output final results** to `final-result-returns-v2/`

### 5. Verification Steps

#### 5.1 Check Aggregation Results
```bash
# Check final results
ls -la final-result-returns-v2/

# Verify domain count matches websites.txt
wc -l websites.txt
jq 'keys | length' final-result-returns-v2/return-info-ALL-SITES-*.json

# Check for duplicates
jq 'keys' final-result-returns-v2/return-info-ALL-SITES-*.json | jq 'group_by(.) | map(select(length > 1)) | .[]'
```

#### 5.2 Validate JSON Structure
```bash
# Check if all domains have consistent structure
jq '.[] | keys | length' final-result-returns-v2/return-info-ALL-SITES-*.json | sort | uniq -c
# Should show all domains have 9 fields (or 2 for failed domains)
```

### 6. Troubleshooting

#### 6.1 Common Issues

**Problem:** Duplicate domains in final output
```bash
# Solution: Re-run aggregation
npx tsx aggregate-final-returns.ts
```

**Problem:** Missing domains from websites.txt
```bash
# Check if domains exist in result-returns-v2/
ls result-returns-v2/return-info-*.json | grep -i "missing-domain"

# If missing, process them individually
npx tsx extract-returns-v2.ts missing-domain.com
```

**Problem:** Inconsistent JSON structure
```bash
# Check structure of problematic domains
jq '.["problematic-domain.com"] | keys' final-result-returns-v2/return-info-ALL-SITES-*.json

# Re-run aggregation to clean structure
npx tsx aggregate-final-returns.ts
```

#### 6.2 Data Quality Issues

**Problem:** Incorrect country-specific data
- The aggregation script automatically detects and penalizes incorrect country data
- Check logs for warnings about UK data in Serbian domains, etc.

**Problem:** Poor quality data
- The script uses quality scoring to prioritize better data
- Check the quality scores in the aggregation logs

### 7. Best Practices

#### 7.1 File Organization
- Keep `result-returns-v2/` organized by machine/country
- Use timestamps in filenames to avoid conflicts
- Backup results before aggregation

#### 7.2 Environment Management
- Use consistent API keys across machines
- Keep `.env` files synchronized
- Use same Docker image versions

#### 7.3 Quality Assurance
- Always verify final results after aggregation
- Check for missing domains
- Validate JSON structure consistency
- Review data quality scores

### 8. Summary

The multi-machine workflow ensures:
- ✅ **Consistent results** across all machines
- ✅ **Automatic deduplication** of domains
- ✅ **Quality-based selection** of best data
- ✅ **Order preservation** from `websites.txt`
- ✅ **Structure validation** and cleaning
- ✅ **Easy merging** of results from multiple sources

This workflow allows you to process large domain lists across multiple machines efficiently while maintaining data quality and consistency. 