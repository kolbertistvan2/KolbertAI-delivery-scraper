# KolbertAI-delivery-scraper v4.1.0

Returns and shipping info extraction for international webshops in Europe.

## What's new in v4.1.0

### 🚀 Major Features
- **Unified JSON Structure**: Pontosan a prompt szerinti JSON struktúra minden domainnél
- **Final Aggregation Script**: `aggregate-final-returns.ts` - deduplikáció és sorrend fenntartás
- **Country-Specific Data Validation**: Automatikus ország-specifikus adatok ellenőrzése
- **Enhanced Data Quality Scoring**: Intelligens adatminőség értékelés duplikátum szűréshez

### 🔧 Technical Enhancements
- **Consistent JSON Format**: Minden domain ugyanazt a 9 mezős struktúrát követi
- **Robust Deduplication**: Domain normalizálás és minőség alapú szűrés
- **Order Preservation**: `websites.txt` sorrend fenntartása a végső outputban
- **Error Handling**: Fejlesztett TypeScript error handling és logging

### 📊 Data Quality Improvements
- **Structure Validation**: Automatikus JSON struktúra tisztítás
- **Duplicate Detection**: Intelligens duplikátum felismerés és szűrés
- **Quality Scoring**: Adatminőség alapú prioritás
- **Country Data Validation**: Helytelen ország-specifikus adatok automatikus felismerése

### 📦 Infrastructure
- **Final Results Directory**: `final-result-returns-v2/` - tisztított végső eredmények
- **Gitignore Updates**: Results mappák automatikus kizárása
- **Docker Image Updates**: Automatikus build és deployment
- **Missing Domain Handling**: Hiányzó domainek placeholder bejegyzésekkel

## Setup

1. Clone the repository
2. Create `.env` file with your API keys:
   ```
   GOOGLE_API_KEY=your_gemini_api_key
   BROWSERBASE_API_KEY=your_browserbase_api_key
   BROWSERBASE_PROJECT_ID=your_project_id
   ```
3. Build Docker image: `docker build -t kolbertai-shipping-extractor .`
4. Run: `./run-batches.sh`

## Usage

### Basic Usage
- Add domains to `websites.txt`
- Set `BATCH_SIZE` environment variable for parallel processing
- Results saved to `result-returns-v2/` directory

### Final Aggregation
After running the scraper, use the final aggregation script:
```bash
npx tsx aggregate-final-returns.ts
```

This will:
- Read all JSON files from `result-returns-v2/`
- Deduplicate domains based on quality scoring
- Maintain exact order from `websites.txt`
- Clean JSON structure to match prompt format exactly
- Output final results to `final-result-returns-v2/`

### Failed Domains Processing
If some domains fail during processing, you can retry them:

1. **Create failed domains list:**
```bash
# Extract failed domains from log files
ls result-returns-v2/failed-*.log | sed 's/result-returns-v2\/failed-//' | sed 's/-[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}T[0-9]\{2\}-[0-9]\{2\}-[0-9]\{2\}-[0-9]\{3\}Z\.log$//' | sort > failed-domains.txt
```

2. **Process failed domains:**
```bash
# Process failed domains individually
npx tsx extract-returns-v2.ts failed-domains.txt

# Or use Docker batch processing
docker run -v $(pwd):/app -e BATCH_SIZE=5 kolbertai-shipping-extractor failed-domains.txt
```

3. **Re-run aggregation:**
```bash
# Re-aggregate with new results
npx tsx aggregate-final-returns.ts
```

### Error Recovery Workflow
1. **Check failed domains:** Look for `failed-*.log` files in `result-returns-v2/`
2. **Create retry list:** Extract domain names from failed logs
3. **Retry processing:** Run failed domains again
4. **Re-aggregate:** Update final results with new data
5. **Verify results:** Check final output in `final-result-returns-v2/`

### Output Structure
The final JSON follows exactly the prompt structure:
```json
{
  "domain.com": {
    "country": "not available",
    "IN_STORE_RETURN": { ... },
    "HOME_COLLECTION": { ... },
    "DROP_OFF_PARCEL_SHOP": { ... },
    "DROP_OFF_PARCEL_LOCKER": { ... },
    "FREE_RETURN": { ... },
    "QR_CODE_BARCODE_PIN": { ... },
    "EXTERNAL_RETURN_PORTAL": { ... },
    "SUMMARY": "..."
  }
}
```

## File Structure

```
├── extract-returns-v2.ts          # Main scraper
├── aggregate-final-returns.ts     # Final aggregation script
├── prompt-return.txt              # Return extraction prompt
├── websites.txt                   # Domain list
├── failed-domains.txt             # Failed domains for retry (optional)
├── result-returns-v2/             # Raw results (gitignored)
├── final-result-returns-v2/       # Final results (gitignored)
└── .gitignore                     # Excludes results folders
```

## Data Quality Features

- **Automatic Structure Cleaning**: Removes extra fields not in prompt
- **Country Data Validation**: Detects incorrect country-specific data
- **Quality Scoring**: Prioritizes better quality data during deduplication
- **Order Preservation**: Maintains exact order from `websites.txt`
- **Duplicate Handling**: Intelligently removes duplicates based on quality
