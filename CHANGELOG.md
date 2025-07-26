# Changelog

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
