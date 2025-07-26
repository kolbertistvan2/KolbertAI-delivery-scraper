import { Stagehand, type ConstructorParams } from "@browserbasehq/stagehand";
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import util from 'util';
import { extractCountryFromDomain, getOptimalRegion } from './region-mapping';

// Handle uncaught exceptions to prevent crashes from shared_worker errors
process.on('uncaughtException', (error) => {
  if (error.message.includes('shared_worker') || error.message.includes('targetInfo')) {
    console.warn('Ignoring shared_worker error:', error.message);
    return;
  }
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  if (message.includes('shared_worker') || message.includes('targetInfo')) {
    console.warn('Ignoring shared_worker rejection:', message);
    return;
  }
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

if (!process.env.BROWSERBASE_API_KEY) {
  throw new Error('BROWSERBASE_API_KEY is missing! Cloud session cannot start.');
}

const RESULT_DIR = 'result-delivery';

// Dynamic prompt loading function
async function loadPromptTemplate(promptFile: string = 'prompt.txt'): Promise<string> {
  try {
    const promptPath = path.join(process.cwd(), promptFile);
    const promptContent = await fs.readFile(promptPath, 'utf-8');
    return promptContent;
  } catch (error) {
    console.error(`Error loading prompt template from ${promptFile}:`, error);
    throw new Error(`Failed to load prompt template: ${promptFile}`);
  }
}

// Általánosított változócsere
function replacePromptVariables(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\$\{${key}\}`, 'g');
    result = result.replace(regex, value);
  }
  return result;
}

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

const stagehandConfig = (domain: string): ConstructorParams => {
  // Extract country from domain and get optimal region
  const country = extractCountryFromDomain(domain);
  const region = getOptimalRegion(country);
  
  console.log(`[${domain}] Using Browserbase region: ${region} for country: ${country}`);
  
  // Map country to optimal proxy geolocation
  const proxyGeolocationMap: Record<string, { country: string; city: string }> = {
    // Eastern Europe - Use local proxies
    'czechia': { country: 'CZ', city: 'PRAGUE' },      // Csehország - Prága
    'hungary': { country: 'HU', city: 'BUDAPEST' },    // Magyarország - Budapest
    'poland': { country: 'PL', city: 'WARSAW' },       // Lengyelország - Varsó
    'slovakia': { country: 'SK', city: 'BRATISLAVA' }, // Szlovákia - Pozsony
    'slovenia': { country: 'SI', city: 'LJUBLJANA' },  // Szlovénia - Ljubljana
    'croatia': { country: 'HR', city: 'ZAGREB' },      // Horvátország - Zágráb
    'serbia': { country: 'RS', city: 'BELGRADE' },     // Szerbia - Belgrád
    'romania': { country: 'RO', city: 'BUCHAREST' },   // Románia - Bukarest
    
    // Western Europe
    'germany': { country: 'DE', city: 'BERLIN' },      // Németország - Berlin
    'france': { country: 'FR', city: 'PARIS' },        // Franciaország - Párizs
    'italy': { country: 'IT', city: 'ROME' },          // Olaszország - Róma
    'spain': { country: 'ES', city: 'MADRID' },        // Spanyolország - Madrid
    'uk': { country: 'GB', city: 'LONDON' },           // Egyesült Királyság - London
    'ireland': { country: 'IE', city: 'DUBLIN' },      // Írország - Dublin
    
    // North America
    'us': { country: 'US', city: 'NEW_YORK' },         // USA - New York
    'canada': { country: 'CA', city: 'TORONTO' },      // Kanada - Toronto
    
    // Fallback
    'default': { country: 'DE', city: 'BERLIN' },      // Alapértelmezett - Berlin
  };
  
  const proxyLocation = proxyGeolocationMap[country] || proxyGeolocationMap['default'];
  
  console.log(`[${domain}] Using proxy geolocation: ${proxyLocation.country}, ${proxyLocation.city}`);
  
  return {
    env: 'BROWSERBASE',
    verbose: 1,
    modelName: 'google/gemini-2.5-flash-preview-05-20',
    modelClientOptions: {
      apiKey: process.env.GOOGLE_API_KEY,
    },
    // Set Browserbase session parameters with optimal proxy geolocation
    browserbaseSessionCreateParams: {
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
      region: region as "us-west-2" | "us-east-1" | "eu-central-1" | "ap-southeast-1",
      proxies: [
        {
          type: "browserbase",
          geolocation: {
            country: proxyLocation.country,
            city: proxyLocation.city
          }
        }
      ]
    }
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
      const newStagehand = new Stagehand(stagehandConfig(domain));
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
    // Set region before creating Stagehand instance
    const country = extractCountryFromDomain(domain);
    const region = getOptimalRegion(country);
    process.env.BROWSERBASE_REGION = region;
    console.log(`[${domain}] Set BROWSERBASE_REGION to: ${region}`);
    
    console.log(`[${domain}] Initializing Stagehand with fresh session...`);
    stagehand = new Stagehand(stagehandConfig(domain));
    await stagehand.init();
    console.log(`[${domain}] Stagehand initialized successfully.`);
    const page = stagehand.page;
    if (!page) throw new Error("Failed to get page instance from Stagehand");

    // Load and process prompt template
    console.log(`[${domain}] Loading prompt template from prompt.txt...`);
    const promptTemplate = await loadPromptTemplate('prompt.txt');
    const variables = { website: domain, country: 'Czechia' };
    const prompt = replacePromptVariables(promptTemplate, variables);
    const hasIslandSurcharge = prompt.includes('island_surcharge');
    
    console.log(`[${domain}] Using prompt with island_surcharge: ${hasIslandSurcharge}`);

    // Step 1: Goto homepage (robust)
    const homepage = `https://${domain}`;
    const stagehandRef = { stagehand };
    await robustGoto(stagehandRef, homepage, domain);
    stagehand = stagehandRef.stagehand;
    const pageAfter = stagehand.page;
    if (!pageAfter) throw new Error("Failed to get page instance from Stagehand after restart");

    // Step 2: Enhanced multi-stage navigation and extraction (inspired by Director.ai)
    console.log(`[${domain}] Starting enhanced shipping information extraction...`);
    
    // First, try to find and click on shipping-related links
    const shippingLinkPrompts = [
      `Find and return the selector for a footer link related to shipping, delivery, or shipping information on ${domain}`,
      `Find and return the selector for a FAQ section or link related to shipping or delivery on ${domain}`,
      `Find and return the selector for a "Shipping" or "Delivery" link in the main navigation or footer of ${domain}`,
      `Find and return the selector for a Terms and Conditions or Customer Service link on ${domain}`,
    ];
    
    let shippingPageData = null;
    let usedPromptIndex = -1;
    
    // Try to navigate to shipping-specific pages
    for (let i = 0; i < shippingLinkPrompts.length; i++) {
      try {
        console.log(`[${domain}] Attempting to find shipping link (attempt ${i + 1})...`);
        const obsResult = await page.observe({ instruction: shippingLinkPrompts[i] });
        
        if (obsResult && Array.isArray(obsResult) && obsResult.length > 0 && obsResult[0]?.selector) {
          const observed = obsResult[0];
          console.log(`[${domain}] Found shipping link, clicking...`);
          
          // Click the shipping link
          await page.act({
            description: `Click the shipping/delivery link for ${domain}`,
            method: 'click',
            arguments: [],
            selector: observed.selector
          });
          
          // Wait a bit for page load
          await page.waitForTimeout(3000);
          
          // Extract data from the shipping page
          console.log(`[${domain}] Extracting shipping information from dedicated page...`);
          shippingPageData = await page.extract({
            instruction: `Extract all shipping information including delivery methods, costs, timeframes, and conditions for shipping to customers from ${domain}`,
            schema: shippingSchema
          });
          
          usedPromptIndex = i;
          break;
        }
      } catch (err) {
        console.warn(`[${domain}] Attempt ${i + 1} failed:`, err);
        // Try to go back to homepage if we navigated away
        try {
          await page.goBack();
          await page.waitForTimeout(2000);
        } catch (backErr) {
          console.warn(`[${domain}] Error going back:`, backErr);
        }
      }
    }
    
    // If we found shipping page data, use it
    if (shippingPageData) {
      console.log(`[${domain}] Successfully extracted from shipping page (method ${usedPromptIndex + 1})`);
      return shippingPageData;
    }
    
    // Step 3: Try to find additional shipping information on homepage
    console.log(`[${domain}] No dedicated shipping page found, extracting from homepage...`);
    
    // Try to find and click on FAQ or Terms links for more info
    const additionalPrompts = [
      `Find and return the selector for a FAQ link on ${domain}`,
      `Find and return the selector for Terms and Conditions link on ${domain}`,
      `Find and return the selector for Customer Service or Help link on ${domain}`,
    ];
    
    for (const additionalPrompt of additionalPrompts) {
      try {
        const obsResult = await page.observe({ instruction: additionalPrompt });
        if (obsResult && Array.isArray(obsResult) && obsResult.length > 0 && obsResult[0]?.selector) {
          console.log(`[${domain}] Found additional info link, clicking...`);
          await page.act({
            description: `Click additional info link for ${domain}`,
            method: 'click',
            arguments: [],
            selector: obsResult[0].selector
          });
          
          await page.waitForTimeout(3000);
          
          // Extract additional data
          const additionalData = await page.extract({
            instruction: `Extract any shipping-related information from this page for ${domain}`,
            schema: shippingSchema
          });
          
          // Go back to homepage
          await page.goBack();
          await page.waitForTimeout(2000);
          
          // Merge with homepage data
          shippingPageData = additionalData;
          break;
        }
      } catch (err) {
        console.warn(`[${domain}] Additional info extraction failed:`, err);
      }
    }
    
    // Step 4: Final extraction from homepage
    console.log(`[${domain}] Performing final extraction from homepage...`);
    const homepageData = await page.extract({
      instruction: `Extract all shipping information including delivery methods, costs, timeframes, and conditions for shipping to customers from ${domain}. If no specific shipping information is found, indicate this clearly.`,
      schema: shippingSchema
    });
    
    // Merge data if we have both
    if (shippingPageData) {
      // Merge the data, preferring shippingPageData for specific fields
      const mergedData = { ...homepageData, ...shippingPageData };
      console.log(`[${domain}] Shipping extraction completed with merged data.`);
      return mergedData;
    } else {
      console.log(`[${domain}] Shipping extraction completed from homepage only.`);
      return homepageData;
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
      console.log(`[${domain}] Attempt ${attempt} of ${maxRetries} with fresh session`);
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
  const resultData: Record<string, any> = {};
  const allDomains = new Set<string>();
  
  // Collect all successful JSONs
  for (const file of files) {
    if (file.startsWith('shipping-info-') && file.endsWith('.json') && !file.startsWith('shipping-info-ALL-SITES')) {
      const filePath = path.join(RESULT_DIR, file);
      try {
        const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
        if (data && data.website) {
          const { website, ...rest } = data;
          resultData[data.website] = rest;
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
          if (!resultData[domain]) {
            resultData[domain] = { error: logContent.trim() };
          }
        }
      } catch (e) {
        console.warn(`Failed to read log ${file}:`, e);
      }
    }
  }
  
  // Read websites.txt to get the original order
  const websitesFile = path.join(process.cwd(), 'websites.txt');
  const orderedResult: Record<string, any> = {};
  
  try {
    const lines = (await fs.readFile(websitesFile, 'utf-8')).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    
    // Build result in the order of websites.txt
    for (const domain of lines) {
      if (resultData[domain]) {
        orderedResult[domain] = resultData[domain];
      } else {
        orderedResult[domain] = { error: 'No result or error log found for this domain.' };
      }
    }
  } catch (e) {
    console.warn('Could not read websites.txt for domain completeness:', e);
    // Fallback to original result if websites.txt cannot be read
    Object.assign(orderedResult, resultData);
  }
  
  const outPath = path.join(RESULT_DIR, `shipping-info-ALL-SITES.json`);
  await fs.writeFile(outPath, JSON.stringify(orderedResult, null, 2), 'utf-8');
  console.log(`Aggregated all site results to ${outPath}`);
}

async function main() {
  const command = process.argv[2];
  
  if (!command) {
    console.error('Usage: node extract-shipping.js <domain> or node extract-shipping.js aggregate');
    process.exit(1);
  }
  
  await ensureResultDir();
  
  if (command === 'aggregate') {
    console.log(`🚀 Starting aggregation of all results...`);
    await aggregateResults();
  } else {
    const domain = command;
    console.log(`🚀 Starting shipping information extraction for: ${domain}`);
    
    const result = await retryProcessDomain(domain, 3);
    
    if (result) {
      const timestamp = getTimestamp();
      const resultFile = path.join(RESULT_DIR, `shipping-info-${domain}-${timestamp}.json`);
      await fs.writeFile(resultFile, JSON.stringify(result, null, 2), 'utf-8');
      console.log(`✅ Results written to: ${resultFile}`);
    } else {
      console.error(`❌ Failed to extract shipping information for: ${domain}`);
      process.exit(1);
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
