import { Stagehand, type ConstructorParams } from "@browserbasehq/stagehand";
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import util from 'util';

if (!process.env.BROWSERBASE_API_KEY) {
  throw new Error('BROWSERBASE_API_KEY is missing! Cloud session cannot start.');
}

const RESULT_DIR = 'result-delivery';

const shippingSchema = z.object({
  website: z.string(),
  HOME_DELIVERY: z.object({
    available: z.string(),
    providers: z.array(z.string()),
    pricing: z.string(),
    free_delivery_limit: z.string(),
    delivery_time: z.string(),
    express_delivery: z.object({
      available: z.string(),
      delivery_time: z.string(),
      pricing: z.string(),
    }),
    weekend_delivery: z.object({
      available: z.string(),
      days: z.union([z.array(z.string()), z.string()]),
    }),
    island_surcharge: z.string(),
    cod_surcharge: z.string(),
  }),
  BULKY_PRODUCT_HOME_DELIVERY: z.object({
    available: z.string(),
    providers: z.array(z.string()),
    pricing: z.string(),
    free_delivery_limit: z.string(),
    delivery_time: z.string(),
    express_delivery: z.object({
      available: z.string(),
      delivery_time: z.string(),
      pricing: z.string(),
    }),
    weekend_delivery: z.object({
      available: z.string(),
      days: z.union([z.array(z.string()), z.string()]),
    }),
    island_surcharge: z.string(),
    cod_surcharge: z.string(),
  }),
  PARCEL_SHOPS: z.object({
    available: z.string(),
    providers: z.array(z.string()),
    locations_count: z.string(),
    pricing: z.string(),
    free_delivery_limit: z.string(),
    express_delivery: z.object({
      available: z.string(),
      delivery_time: z.string(),
      pricing: z.string(),
    }),
    weekend_delivery: z.object({
      available: z.string(),
      days: z.union([z.array(z.string()), z.string()]),
    }),
    island_surcharge: z.string(),
    cod_surcharge: z.string(),
  }),
  PARCEL_LOCKERS: z.object({
    available: z.string(),
    providers: z.array(z.string()),
    locations_count: z.string(),
    pricing: z.string(),
    free_delivery_limit: z.string(),
    express_delivery: z.object({
      available: z.string(),
      delivery_time: z.string(),
      pricing: z.string(),
    }),
    weekend_delivery: z.object({
      available: z.string(),
      days: z.union([z.array(z.string()), z.string()]),
    }),
    island_surcharge: z.string(),
    cod_surcharge: z.string(),
  }),
  IN_STORE_PICKUP: z.object({
    available: z.string(),
    locations: z.union([z.array(z.string()), z.string()]),
    pricing: z.string(),
    free_delivery_limit: z.string(),
    express_delivery: z.object({
      available: z.string(),
      delivery_time: z.string(),
      pricing: z.string(),
    }),
    weekend_delivery: z.object({
      available: z.string(),
      days: z.union([z.array(z.string()), z.string()]),
    }),
    island_surcharge: z.string(),
    cod_surcharge: z.string(),
  }),
  SUMMARY: z.string(),
});

const stagehandConfig = (): ConstructorParams => {
  return {
    env: 'BROWSERBASE',
    verbose: 1,
    modelName: 'google/gemini-2.5-pro',
    modelClientOptions: {
      apiKey: process.env.GOOGLE_API_KEY,
    },
  };
};

function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-');
}

async function ensureResultDir() {
  try {
    await fs.mkdir(RESULT_DIR);
  } catch (e: any) {
    if (e.code !== 'EEXIST') throw e;
  }
}

// --- Robust goto with restart: closes and recreates Stagehand on error ---
async function robustGoto(stagehandRef: { stagehand: Stagehand }, url: string, domain: string, maxRetries = 3): Promise<void> {
  let attempt = 0;
  let lastError: any = null;
  while (attempt < maxRetries) {
    try {
      console.log(`[${domain}] [Goto attempt ${attempt + 1}] Navigating to: ${url}`);
      await stagehandRef.stagehand.page.goto(url);
      return;
    } catch (err: any) {
      lastError = err;
      console.warn(`⚠️ [${domain}] Goto error: ${err.message || err}`);
      // Close old session
      try {
        await stagehandRef.stagehand.close();
      } catch (closeErr) {
        console.warn(`[${domain}] Error closing Stagehand during restart:`, closeErr);
      }
      // Recreate Stagehand (proxy support: TODO if needed)
      const newStagehand = new Stagehand(stagehandConfig());
      console.warn(`🔄 [${domain}] Restarting Stagehand (attempt ${attempt + 1})...`);
      await newStagehand.init();
      stagehandRef.stagehand = newStagehand;
      attempt++;
    }
  }
  throw lastError;
}

async function processDomain(domain: string) {
  let stagehand: Stagehand | null = null;
  try {
    console.log(`[${domain}] Initializing Stagehand...`);
    stagehand = new Stagehand(stagehandConfig());
    await stagehand.init();
    console.log(`[${domain}] Stagehand initialized successfully.`);
    const page = stagehand.page;
    if (!page) throw new Error("Failed to get page instance from Stagehand");

    // Step 1: Goto homepage (robust)
    const homepage = `https://${domain}`;
    const stagehandRef = { stagehand };
    await robustGoto(stagehandRef, homepage, domain);
    stagehand = stagehandRef.stagehand;
    const pageAfter = stagehand.page;
    if (!pageAfter) throw new Error("Failed to get page instance from Stagehand after restart");

    // Step 2: Multi-stage observe fallback
    const observePromptMain = `Stagehand tool használatával:\n\n1. Navigate to homepage of the website: ${domain}\n2. Search for shipping information to Croatia in these locations:\n* Dedicated shipping info pages (/dostava, /shipping, /delivery)\n* Footer links: \"dostava\", \"shipping\", \"informacije o dostavi\", \"troškovi dostave\"\n* FAQ section: search for shipping/delivery keywords in Croatian\n* Terms & Conditions page for shipping terms\n\n3. Extract shipping information from all relevant pages\n\nEXTRACT EXACTLY THESE SHIPPING CATEGORIES:\n\nHOME DELIVERY:\n* Available: yes/no\n* Providers: [list of shipping companies such as: GLS, Hrvatska pošta, DPD, Overseas Express, DHL, UPS, Gebrüder Weiss, InTime, etc.]\n* Pricing: [price information and free shipping thresholds]\n* Delivery time: [timeframe - e.g., 2-5 business days]\n* Express delivery: [availability, pricing, delivery time]\n* Weekend delivery: [availability, which days]\n* Island surcharge: [extra cost or delivery restrictions to Croatian islands like Rab, Krk, Brač, Hvar, etc.]\n* COD surcharge: [cash on delivery surcharge]\n\nBULKY PRODUCT HOME DELIVERY:\n* Available: yes/no\n* Providers: [list of shipping companies for bulky items such as: GLS, Hrvatska pošta, DPD, Overseas Express, etc.]\n* Pricing: [price information for bulky items]\n* Delivery time: [timeframe for bulky items]\n* Express delivery: [availability, pricing, delivery time for bulky items]\n* Weekend delivery: [availability, which days for bulky items]\n* Island surcharge: [extra cost or delivery restrictions to islands for bulky items]\n* COD surcharge: [cash on delivery surcharge for bulky items]\n\nPARCEL SHOPS / PICKUP POINTS:\n* Available: yes/no\n* Providers: [such as: GLS, Hrvatska pošta, DPD, Overseas Express, etc.]\n* Number of locations: [number if visible]\n* Pricing: [price information]\n* Express delivery: [availability, pricing, delivery time]\n* Weekend delivery: [availability, which days]\n* Island surcharge: [extra cost or delivery restrictions to islands]\n* COD surcharge: [cash on delivery surcharge]\n\nPARCEL LOCKERS:\n* Available: yes/no\n* Providers: [such as: Box Now, GLS, Hrvatska pošta, DPD, Overseas Express, etc.]\n* Number of locations: [number if visible]\n* Pricing: [price information]\n* Express delivery: [availability, pricing, delivery time]\n* Weekend delivery: [availability, which days]\n* Island surcharge: [extra cost or delivery restrictions to islands]\n* COD surcharge: [cash on delivery surcharge]\n\nIN-STORE PICKUP:\n* Available: yes/no\n* Locations: [store locations/cities if available]\n* Pricing: [price information]\n* Express delivery: [availability, pricing, delivery time]\n* Weekend delivery: [availability, which days]\n* Island surcharge: [extra cost or delivery restrictions to islands]\n* COD surcharge: [cash on delivery surcharge]\n\nWebsite: ${domain} Country: HR\n\nResponse Format: Return exactly this JSON structure. If a field is unavailable, write \"not available\". Strings should be human-readable.\n{\n  \"website\": \"${domain}\",\n  \"HOME_DELIVERY\": {\n    \"available\": \"yes/no/not available\",\n    \"providers\": [\"provider1\", \"provider2\"],\n    \"pricing\": \"price info or not available\",\n    \"delivery_time\": \"timeframe or not available\",\n    \"express_delivery\": {\n      \"available\": \"yes/no/not available\",\n      \"delivery_time\": \"timeframe or not available\",\n      \"pricing\": \"price info or not available\"\n    },\n    \"weekend_delivery\": {\n      \"available\": \"yes/no/not available\",\n      \"days\": [\"Saturday\", \"Sunday\"] or \"not available\"\n    },\n    \"island_surcharge\": \"extra cost or delivery restrictions to Croatian islands like Rab, Krk, Brač, Hvar, etc., or not available\",\n    \"cod_surcharge\": \"exact surcharge or not available\"\n  },\n  \"BULKY_PRODUCT_HOME_DELIVERY\": {\n    \"available\": \"yes/no/not available\",\n    \"providers\": [\"provider1\", \"provider2\"],\n    \"pricing\": \"price info or not available\",\n    \"delivery_time\": \"timeframe or not available\",\n    \"express_delivery\": {\n      \"available\": \"yes/no/not available\",\n      \"delivery_time\": \"timeframe or not available\",\n      \"pricing\": \"price info or not available\"\n    },\n    \"weekend_delivery\": {\n      \"available\": \"yes/no/not available\",\n      \"days\": [\"Saturday\", \"Sunday\"] or \"not available\"\n    },\n    \"island_surcharge\": \"extra cost or delivery restrictions to islands or not available\",\n    \"cod_surcharge\": \"exact surcharge or not available\"\n  },\n  \"PARCEL_SHOPS\": {\n    \"available\": \"yes/no/not available\",\n    \"providers\": [\"provider1\", \"provider2\"],\n    \"locations_count\": \"number or not available\",\n    \"pricing\": \"price info or not available\",\n    \"express_delivery\": {\n      \"available\": \"yes/no/not available\",\n      \"delivery_time\": \"timeframe or not available\",\n      \"pricing\": \"price info or not available\"\n    },\n    \"weekend_delivery\": {\n      \"available\": \"yes/no/not available\",\n      \"days\": [\"Saturday\", \"Sunday\"] or \"not available\"\n    },\n    \"island_surcharge\": \"extra cost or delivery restrictions to islands or not available\",\n    \"cod_surcharge\": \"exact surcharge or not available\"\n  },\n  \"PARCEL_LOCKERS\": {\n    \"available\": \"yes/no/not available\",\n    \"providers\": [\"provider1\", \"provider2\"],\n    \"locations_count\": \"number or not available\",\n    \"pricing\": \"price info or not available\",\n    \"express_delivery\": {\n      \"available\": \"yes/no/not available\",\n      \"delivery_time\": \"timeframe or not available\",\n      \"pricing\": \"price info or not available\"\n    },\n    \"weekend_delivery\": {\n      \"available\": \"yes/no/not available\",\n      \"days\": [\"Saturday\", \"Sunday\"] or \"not available\"\n    },\n    \"island_surcharge\": \"extra cost or delivery restrictions to islands or not available\",\n    \"cod_surcharge\": \"exact surcharge or not available\"\n  },\n  \"IN_STORE_PICKUP\": {\n    \"available\": \"yes/no/not available\",\n    \"locations\": [\"city1\", \"city2\"] or \"not available\",\n    \"pricing\": \"price info or not available\",\n    \"express_delivery\": {\n      \"available\": \"yes/no/not available\",\n      \"delivery_time\": \"timeframe or not available\",\n      \"pricing\": \"price info or not available\"\n    },\n    \"weekend_delivery\": {\n      \"available\": \"yes/no/not available\",\n      \"days\": [\"Saturday\", \"Sunday\"] or \"not available\"\n    },\n    \"island_surcharge\": \"extra cost or delivery restrictions to islands or not available\",\n    \"cod_surcharge\": \"exact surcharge or not available\"\n  },\n  \"SUMMARY\": \"[Brief summary of delivery options, providers, pricing, and restrictions]. NOTABLE FEATURES: [Key features, limitations, and special services]. WEBSITE ASSESSMENT: [Overall evaluation of shipping information quality and completeness].\"\n}\n\nIf something is not available or not found, write \"not available\".\nOnly extract information that is explicitly visible on the pages. Do not assume or guess.\n\nIMPORTANT: The SUMMARY field should be formatted as a single text string that will work well when converted to a table format in Excel/CSV. Use clear section headers and concise descriptions separated by periods and line breaks where appropriate.`;
    const fallbackPrompts = [
      observePromptMain,
      `Find and return the selector for a footer link related to shipping or delivery (e.g. 'dostava', 'shipping', 'informacije o dostavi', 'isporuka', 'prijevoz') on the homepage of ${domain}.`,
      `Find and return the selector for a FAQ section or link related to shipping or delivery on the homepage of ${domain}.`,
      `Find and return the selector for a Terms and Conditions ("Uvjeti korištenja" or similar) link on the homepage of ${domain}.`,
    ];
    let observed = null;
    let usedPromptIndex = -1;
    for (let i = 0; i < fallbackPrompts.length; i++) {
      const obsPrompt = fallbackPrompts[i];
      console.log(`[${domain}] Observing (stage ${i+1}) with prompt:`, obsPrompt);
      const obsResult = await page.observe({ instruction: obsPrompt });
      if (obsResult && Array.isArray(obsResult) && obsResult.length > 0 && obsResult[0]?.selector) {
        observed = obsResult[0];
        usedPromptIndex = i;
        break;
      }
    }
    if (observed) {
      const fallbackNames = ['main', 'footer', 'faq', 'terms'];
      console.log(`[${domain}] Observed selector (fallback: ${fallbackNames[usedPromptIndex]}):`, observed.selector);
      // Step 3: Act (click) on the observed link
      console.log(`[${domain}] Clicking observed shipping/delivery link...`);
      await page.act({
        description: `Click the observed shipping/delivery link for ${domain}`,
        method: 'click',
        arguments: [],
        selector: observed.selector
      });
      // Step 4: Extract shipping info
      console.log(`[${domain}] Extracting shipping information...`);
      const extractedData = await page.extract({
        instruction: observePromptMain,
        schema: shippingSchema
      });
      console.log(`[${domain}] Extraction completed successfully.`);
      return extractedData;
    } else {
      // Fallback: extract directly from homepage
      console.log(`[${domain}] No link found in any observe stage, extracting directly from homepage...`);
      const extractedData = await page.extract({
        instruction: observePromptMain,
        schema: shippingSchema
      });
      return extractedData;
    }
  } catch (err) {
    console.error(`[${domain}] Error processing:`, err);
    // Log error to file
    const errorFile = path.join(RESULT_DIR, `error-${domain}-${getTimestamp()}.log`);
    let stack = '';
    if (err instanceof Error) {
      stack = err.stack || '';
    }
    const errorMsg = `[${domain}] Error: ${util.format(err)}\nStack: ${stack}`;
    await fs.writeFile(errorFile, errorMsg, 'utf-8');
    return null;
  } finally {
    if (stagehand) {
      console.log(`[${domain}] Closing Stagehand session.`);
      try {
        await stagehand.close();
      } catch (closeErr) {
        console.error(`[${domain}] Error closing Stagehand session:`, closeErr);
      }
    }
  }
}

async function retryProcessDomain(domain: string, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[${domain}] Attempt ${attempt} of ${maxRetries}`);
      const result = await processDomain(domain);
      if (result) return result;
    } catch (err) {
      console.error(`[${domain}] Attempt ${attempt} failed:`, err);
    }
  }
  // Ha minden próbálkozás sikertelen, logoljuk külön
  const errorFile = path.join(RESULT_DIR, `failed-${domain}-${getTimestamp()}.log`);
  await fs.writeFile(errorFile, `[${domain}] Failed after ${maxRetries} attempts\n`, 'utf-8');
  return null;
}

async function aggregateResults() {
  const files = await fs.readdir(RESULT_DIR);
  const result: Record<string, any> = {};
  const allDomains = new Set<string>();
  // Collect all successful JSONs
  for (const file of files) {
    if (file.startsWith('shipping-info-') && file.endsWith('.json') && !file.startsWith('shipping-info-ALL-SITES')) {
      const filePath = path.join(RESULT_DIR, file);
      try {
        const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
        if (data && data.website) {
          const { website, ...rest } = data;
          result[data.website] = rest;
          allDomains.add(data.website);
        }
      } catch (e) {
        console.warn(`Failed to parse ${file}:`, e);
      }
    }
  }
  // Add error and failed logs for missing domains
  for (const file of files) {
    if ((file.startsWith('error-') || file.startsWith('failed-')) && file.endsWith('.log')) {
      const filePath = path.join(RESULT_DIR, file);
      try {
        const logContent = await fs.readFile(filePath, 'utf-8');
        // Try to extract domain from filename: error-<domain>-... or failed-<domain>-...
        const match = file.match(/^(error|failed)-([^.]+)-/);
        if (match) {
          const domain = match[2];
          allDomains.add(domain);
          if (!result[domain]) {
            result[domain] = { error: logContent.trim() };
          }
        }
      } catch (e) {
        console.warn(`Failed to read log ${file}:`, e);
      }
    }
  }
  // Ensure all domains from input are present (even if missing result/log)
  const websitesFile = path.join(process.cwd(), 'websites.txt');
  try {
    const lines = (await fs.readFile(websitesFile, 'utf-8')).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    for (const domain of lines) {
      if (!allDomains.has(domain)) {
        result[domain] = { error: 'No result or error log found for this domain.' };
      }
    }
  } catch (e) {
    console.warn('Could not read websites.txt for domain completeness:', e);
  }
  const outPath = path.join(RESULT_DIR, `shipping-info-ALL-SITES-${getTimestamp()}.json`);
  await fs.writeFile(outPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`Aggregated all site results to ${outPath}`);
}

async function main() {
  await ensureResultDir();
  const domains = process.argv.slice(2);
  if (domains.length === 0) {
    console.error('Usage: node extract-shipping.js <domain1> <domain2> ...');
    process.exit(1);
  }
  for (const domain of domains) {
    const outFile = path.join(RESULT_DIR, `shipping-info-${domain}-${getTimestamp()}.json`);
    // Check if result already exists
    const resultPattern = new RegExp(`^shipping-info-${domain}-.*\.json$`);
    const existingFiles = await fs.readdir(RESULT_DIR);
    const alreadyExists = existingFiles.some(f => resultPattern.test(f));
    if (alreadyExists) {
      console.log(`Skipping ${domain}: result already exists.`);
      continue;
    }
    console.log(`Processing: ${domain}`);
    const data = await retryProcessDomain(domain, 3);
    await fs.writeFile(outFile, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Result for ${domain} written to ${outFile}`);
  }
  await aggregateResults();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
