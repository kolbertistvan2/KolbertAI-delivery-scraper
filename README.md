# KolbertAI-delivery-scraper v4.0.0

Returns and shipping info extraction for international webshops in Europe.

## What's new in v4.0.0

### 🚀 Major Features
- **LLM-Powered Data Cleaning**: Intelligens adattisztítás Gemini 2.5 Flash Preview modellel
- **Director.ai-Style Processing**: Összegyűjtött adatok feldolgozása egyetlen LLM hívással
- **Enhanced Batch Processing**: Párhuzamos feldolgozás `BATCH_SIZE` támogatással (10-es batch size optimalizált)
- **Union Merge Strategy**: Egyszerű union merge logika prioritás helyett

### 🔧 Technical Enhancements
- **Gemini 2.5 Flash Preview**: Minden LLM hívás frissítve a legújabb modelre
- **Rate Limit Optimization**: 1,000 RPM limit támogatás
- **Environment Variable Loading**: `dotenv` integráció `GOOGLE_API_KEY` betöltéshez
- **Error Handling**: Fejlesztett TypeScript error handling

### 📊 Data Quality Improvements
- **Duplicate Removal**: LLM-alapú duplikátum eltávolítás
- **Contradiction Resolution**: Intelligens ellentmondás feloldás
- **Standardized Values**: Konzisztens "yes"/"no" és időformátumok
- **Structured Output**: Pontos JSON struktúra fenntartása

### 📦 Infrastructure
- **Docker Image Updates**: Automatikus build és deployment
- **Result Aggregation**: `ALL-SITES` fájl helyes sorrendben `websites.txt` alapján
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

- Add domains to `websites.txt`
- Set `BATCH_SIZE` environment variable for parallel processing
- Results saved to `result/` directory
