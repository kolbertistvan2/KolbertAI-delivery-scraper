# Changelog

## [4.0.0] - 2025-01-27
### 🚀 Major Features
- **LLM-Powered Data Cleaning**: `cleanDataWithLLM` funkció Gemini 2.5 Flash Preview modellel
- **Director.ai-Style Processing**: Összegyűjtött adatok intelligens feldolgozása egyetlen LLM hívással
- **Union Merge Strategy**: Egyszerű union merge logika prioritás helyett
- **Enhanced Batch Processing**: Párhuzamos feldolgozás `BATCH_SIZE` environment variable-lal

### 🔧 Technical Enhancements
- **Gemini 2.5 Flash Preview**: Minden LLM hívás frissítve a legújabb modelre
- **Rate Limit Optimization**: 10-es batch size támogatás (1,000 RPM limit)
- **Environment Variable Loading**: `dotenv` integráció `GOOGLE_API_KEY` betöltéshez
- **Error Handling Improvements**: TypeScript error casting javítása

### 📊 Data Quality Improvements
- **Duplicate Removal**: LLM-alapú duplikátum eltávolítás és ellentmondás feloldás
- **Standardized Values**: Konzisztens "yes"/"no" és időformátumok
- **Contradiction Resolution**: Intelligens ellentmondás feloldás a legmegbízhatóbb információ alapján
- **Structured Output**: Pontos JSON struktúra fenntartása

### 🌐 Language & Translation
- **Enhanced Translation**: `translateToEnglish` funkció fejlesztése
- **JSON Parsing Fix**: Markdown formázás eltávolítása LLM válaszokból
- **Error Recovery**: Fordítási hibák esetén eredeti adat használata

### 📦 Infrastructure & Deployment
- **Docker Image Updates**: Automatikus build és deployment
- **Batch Script Improvements**: `run-returns-v2-batch.sh` párhuzamos feldolgozással
- **Result Aggregation**: `ALL-SITES` fájl helyes sorrendben `websites.txt` alapján
- **Missing Domain Handling**: Hiányzó domainek placeholder bejegyzésekkel

### 🐛 Bug Fixes
- **API Key Loading**: `.env` fájl betöltés javítása
- **EOF Error Fix**: `run-returns-v2-batch.sh` szintaxis hiba javítása
- **Order Preservation**: Domain sorrend fenntartása aggregált eredményekben
- **TypeScript Errors**: Error casting és async/await javítások

### 📝 Documentation
- **PRD Document**: "Prompt-to-Script Generator" termék követelmények dokumentációja
- **Rate Limit Analysis**: Gemini 2.5 Flash Preview rate limit dokumentáció
- **Batch Processing Guide**: 10-es batch size optimalizáció

## [3.0.0] - 2025-01-XX
### 🚀 Major Features
- **Returns Information Extraction**: Új `extract-returns-v2.ts` script returns információk kinyeréséhez
- **Direct Navigation Strategy**: LLM-alapú XPath generálás és közvetlen navigáció
- **Multi-page Data Extraction**: Több oldalról való adatkinyerés és egyesítés
- **Fresh Session per Domain**: Minden domain új Browserbase session-tel

### 🌍 Regional & Proxy Improvements
- **Dynamic Region Selection**: Automatikus region kiválasztás domain országa alapján
- **Proxy Geolocation**: Célország-specifikus proxy IP (pl. Prága Csehországhoz)
- **Target Country in Prompts**: Explicit ország meghatározás prompt elején

### 🔧 Technical Enhancements
- **Shared Worker Error Handling**: Process-level hibakezelés `shared_worker` és `targetInfo` hibákhoz
- **Cookie Consent Handling**: Automatikus cookie elfogadás
- **Robust Navigation**: `robustGoto` funkció timeout és retry logikával
- **Aggregation Fix**: `ALL-SITES` fájl automatikus generálása batch futtatások után

### 🌐 Language & Localization
- **English Output Enforcement**: Minden kinyert információ angol nyelven
- **Proper Noun Preservation**: Cégnevek, márkanevek, helynevek eredeti nyelven maradnak
- **Dynamic Country Variables**: `${country}` változó használata promptokban

### 📝 Prompt Improvements
- **Returns Prompt**: `prompt-return.txt` teljes átírása returns specifikus logikával
- **Shipping Prompt**: `prompt.txt` frissítése ugyanazzal a logikával
- **Explicit Instructions**: Kritikus, kötelező és végső emlékeztető szekciók

### 🐛 Bug Fixes
- **Region Setting Fix**: `BROWSERBASE_REGION` environment variable helyes beállítása
- **Session Management**: Browserbase session region és proxy beállítások javítása
- **Error Recovery**: Retry mechanizmus fejlesztése

### 📦 Infrastructure
- **Docker Configuration**: Entrypoint script frissítése `extract-returns-v2.ts`-re
- **Batch Processing**: `run-returns-batches.sh` script returns feldolgozáshoz
- **Result Organization**: Automatikus timestamp-alapú fájlnév generálás

## [1.0.0] - Initial release
- Első működő verzió: shipping extraction, batch processing, error handling, aggregált output.
