# Extract-Croatian-Shipping-Info v1.0.0
# Croatian Shipping Info Extractor

Extract shipping information from Croatian and international webshops using AI.

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
