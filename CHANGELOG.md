# Changelog

## [1.0.0] - Initial release
- Első működő verzió: shipping extraction, batch processing, error handling, aggregált output.

## [2.2.0] - 2025-07-11
- Stagehand dependency frissítve a legújabb (2.4.0) verzióra
- Alapértelmezett LLM modell: Anthropic Claude 4 Sonnet (anthropic/claude-sonnet-4-20250514)
- extract-shipping.ts és extract-returns.ts Stagehand config módosítva
- Batch scriptek (run-batches.sh, run-returns-batches.sh) javítva, hogy mindig a megfelelő TS szkriptet hívják
- Docker image rebuild szükséges

## [2.2.1] - 2025-07-11
- ALL-SITES aggregáció mostantól websites.txt sorrendben
- Minden domain kap sorszámot ('order')
- Failed domainek is bekerülnek az összesítő JSON-ba
