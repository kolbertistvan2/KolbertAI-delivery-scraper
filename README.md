# KolbertAI-delivery-scraper v2.2.1

Shipping info extraction for international webshops in Europe.

## What's new in 2.2.1

- Stagehand dependency frissítve a legújabb (2.4.0) verzióra
- Alapértelmezett LLM modell: Anthropic Claude 4 Sonnet (anthropic/claude-sonnet-4-20250514)
- ALL-SITES aggregáció mostantól websites.txt sorrendben, minden domain kap sorszámot ('order'), failed domainek is bekerülnek
- extract-shipping.ts és extract-returns.ts Stagehand config módosítva
- Batch scriptek (run-batches.sh, run-returns-batches.sh) javítva, hogy mindig a megfelelő TS szkriptet hívják
- Docker image rebuild szükséges

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

- Add domains to `websites.txt`
- Set `BATCH_SIZE` environment variable for parallel processing
- Results saved to `result/` directory
