# KolbertAI-delivery-scraper – Project Manual

## Áttekintés
Ez a projekt automatizált módon extrahál szállítási (delivery) és visszaküldési (return) információkat webshopokból, ország-specifikus promptok és a Stagehand (Browserbase) AI böngészőautomatizáció segítségével.

---

## Fő komponensek

### 1. Prompt generálás
- **Fájl:** `generate-prompt.js`
- **Funkció:** Ország-specifikus promptokat generál a `prompts/` könyvtárba, minden ország saját nyelvén, lokalizált kulcsszavakkal és példákkal.
- **Prompt típusok:**
  - Szállítási promptok: `prompts/prompt.{country}.txt`
  - Visszaküldési promptok: `prompts/prompt-returns.{country}.txt`

### 2. Extractálás (adatkinyerés)
- **Szkriptek:**
  - `extract-shipping.ts` – szállítási információk
  - `extract-returns.ts` – visszaküldési információk
- **Fő lépések:**
  1. Betölti a feldolgozandó domaineket a `websites.txt`-ből.
  2. Betölti a megfelelő promptot (ország-specifikus vagy generikus).
  3. Inicializálja a Stagehand-et a kiválasztott LLM-mel (lásd: Stagehand konfiguráció).
  4. Megnyitja a webshopot, végrehajtja a promptban leírt lépéseket (observe, act, extract).
  5. Az eredményt JSON fájlba menti a `result/` vagy `result-delivery/` mappába.

### 3. Batch futtatás
- **Script:** `run-batches.sh` vagy Docker Compose
- **Funkció:** Több domaint dolgoz fel párhuzamosan, hibatűrő módon, összefoglalóval a végén.

### 4. Környezeti változók
- `.env` fájlban tárolod az API kulcsokat:
  - `GOOGLE_API_KEY` – Google Gemini modellekhez
  - `ANTHROPIC_API_KEY` – Anthropic Claude modellekhez
  - `OPENAI_API_KEY` – OpenAI modellekhez
  - `BROWSERBASE_API_KEY` – Stagehand/Browserbase API-hoz
  - `BROWSERBASE_PROJECT_ID` – Browserbase projekt azonosító
  - `BATCH_SIZE` – Párhuzamos feldolgozás mérete

---

## Stagehand/LLM konfiguráció

A Stagehand agent inicializálása **mindkét fő szkriptben** (extract-shipping.ts, extract-returns.ts) a következő függvényben történik:

```
const stagehandConfig = (): ConstructorParams => {
  return {
    env: 'BROWSERBASE',
    verbose: 1,
    modelName: 'google/gemini-2.5-pro', // <-- Itt tudsz modellt/provider-t váltani!
    modelClientOptions: {
      apiKey: process.env.GOOGLE_API_KEY,
    },
  };
};
```

**Modell/providerváltás példák:**
- Anthropic Claude 3 Opus:
  ```js
  modelName: 'anthropic/claude-3-opus-20240229',
  modelClientOptions: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
  ```
- OpenAI GPT-4o:
  ```js
  modelName: 'openai/gpt-4o',
  modelClientOptions: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  ```

A Stagehand példányosítása minden domain feldolgozásánál:
```
stagehand = new Stagehand(stagehandConfig());
await stagehand.init();
```

---

## Fő workflow

1. **Domain lista:**
   - A `websites.txt` tartalmazza a feldolgozandó webshop domaineket.
2. **Prompt generálás:**
   - A `generate-prompt.js` generálja a promptokat ország-specifikusan, a `prompts/` könyvtárba.
3. **Extractálás:**
   - A `extract-shipping.ts` és `extract-returns.ts` szkriptek végigmennek a domaineken, Stagehand segítségével.
4. **Batch futtatás:**
   - A `run-batches.sh` vagy Docker Compose segítségével párhuzamosan is futtatható a feldolgozás.
5. **Eredmények:**
   - Minden domain eredménye külön JSON fájlba kerül a `result/` vagy `result-delivery/` mappába.

---

## Modell/providerváltás lépései

1. Nyisd meg az `extract-shipping.ts` és/vagy `extract-returns.ts` fájlt.
2. Keresd meg a `stagehandConfig` függvényt.
3. Módosítsd a `modelName` és a megfelelő `apiKey` értékét a kívánt modell/providertől függően.
4. `.env`-ben legyen meg az új API kulcs.
5. Mentsd el, buildeld újra a Docker image-et (ha szükséges), majd teszteld a pipeline-t.

---

## Hibakezelés, logolás
- Minden domain feldolgozása külön try/catch blokkban fut, hiba esetén logfájlba menti az üzenetet.
- A Stagehand példányokat minden feldolgozás végén bezárja (finally blokk).

---

## További információk
- Promptok szerkesztése: `generate-prompt.js` és a `prompts/` könyvtár
- Stagehand dokumentáció: [https://github.com/browserbase/stagehand](https://github.com/browserbase/stagehand)
- Anthropic, OpenAI modellek: [https://github.com/browserbase/open-operator](https://github.com/browserbase/open-operator)

---

Ha bármilyen további kérdésed van, vagy részletesebb architektúra/folyamatábra kell, jelezd! 