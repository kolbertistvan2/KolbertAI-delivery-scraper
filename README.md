# KolbertAI-delivery-scraper v2.1.0

Shipping info extraction for Croatian and international webshops.

## What's new in 2.1.0

- Delivery promptok minden országban angol nyelvű kitöltési elvárásokat tartalmaznak (minden mezőnél és a végső instrukciókban is)
- Return promptok továbbra is teljesen lokalizáltak, de minden válasz angolul elvárt
- A prompt generálás teljesen dinamikus, minden ország saját nyelvén és példáival működik, de a válaszok egységesen angolul készülnek

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
