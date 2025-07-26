import { Stagehand, type ConstructorParams } from "@browserbasehq/stagehand";
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import util from 'util';
import { extractCountryFromDomain, getOptimalRegion } from './region-mapping';

if (!process.env.BROWSERBASE_API_KEY) {
  throw new Error('BROWSERBASE_API_KEY is missing! Cloud session cannot start.');
}

const RESULT_DIR = 'result-returns';

// Return schema
const returnSchema = z.object({
  website: z.string(),
  IN_STORE_RETURN: z.object({
    available: z.string(),
    locations: z.union([z.array(z.string()), z.string()]),
    time_limit: z.string(),
    conditions: z.string()
  }),
  HOME_COLLECTION: z.object({
    available: z.string(),
    providers: z.union([z.array(z.string()), z.string()]),
    cost: z.string(),
    time_limit: z.string(),
    conditions: z.string()
  }),
  DROP_OFF_PARCEL_SHOP: z.object({
    available: z.string(),
    providers: z.union([z.array(z.string()), z.string()]),
    cost: z.string(),
    time_limit: z.string()
  }),
  DROP_OFF_PARCEL_LOCKER: z.object({
    available: z.string(),
    providers: z.union([z.array(z.string()), z.string()]),
    cost: z.string(),
    time_limit: z.string()
  }),
  FREE_RETURN: z.object({
    available: z.string(),
    conditions: z.string(),
    methods: z.string()
  }),
  QR_CODE_BARCODE_PIN: z.object({
    available: z.string(),
    usage: z.string(),
    providers: z.union([z.array(z.string()), z.string()])
  }),
  EXTERNAL_RETURN_PORTAL: z.object({
    available: z.string(),
    url: z.string(),
    features: z.string()
  }),
  SUMMARY: z.string()
});

// Replace country-specific prompt loading with a single prompt-return.txt
async function loadPrompt(): Promise<string> {
  const promptPath = path.join(process.cwd(), 'prompt-return.txt');
  try {
    const prompt = await fs.readFile(promptPath, 'utf-8');
    return prompt.trim();
  } catch (error) {
    console.error(`Prompt not found: ${promptPath}`);
    throw new Error(`Prompt not found: ${promptPath}`);
  }
}

function replacePromptVariables(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
    result = result.replace(regex, value);
  }
  return result;
}

const stagehandConfig = (domain: string): ConstructorParams => {
  // Extract country from domain and get optimal region
  const country = extractCountryFromDomain(domain);
  const region = getOptimalRegion(country);
  
  // Set environment variable for Browserbase region
  process.env.BROWSERBASE_REGION = region;
  
  return {
    env: 'BROWSERBASE',
    verbose: 1,
    modelName: 'google/gemini-2.5-flash-preview-05-20',
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
      try {
        await stagehandRef.stagehand.close();
      } catch (closeErr) {
        console.warn(`[${domain}] Error closing Stagehand during restart:`, closeErr);
      }
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
    console.log(`[${domain}] Initializing Stagehand...`);
    stagehand = new Stagehand(stagehandConfig(domain));
    await stagehand.init();
    console.log(`[${domain}] Stagehand initialized successfully.`);
    const page = stagehand.page;
    if (!page) throw new Error("Failed to get page instance from Stagehand");

    // Load and process prompt template
    console.log(`[${domain}] Loading prompt from prompt-return.txt...`);
    const promptTemplate = await loadPrompt();
    const variables = { website: domain };
    const prompt = replacePromptVariables(promptTemplate, variables);
    
    // Step 1: Goto homepage (robust)
    const homepage = `https://${domain}`;
    const stagehandRef = { stagehand };
    await robustGoto(stagehandRef, homepage, domain);
    stagehand = stagehandRef.stagehand;
    const pageAfter = stagehand.page;
    if (!pageAfter) throw new Error("Failed to get page instance from Stagehand after restart");

    // Step 2: Enhanced multi-stage navigation and extraction (inspired by Director.ai)
    console.log(`[${domain}] Starting enhanced return information extraction...`);
    
    // First, try to find and click on return-related links
    const returnLinkPrompts = [
      `Find and return the selector for a footer link related to returns, refunds, or exchanges on ${domain}`,
      `Find and return the selector for a FAQ section or link related to returns or refunds on ${domain}`,
      `Find and return the selector for a "Returns" or "Refunds" link in the main navigation or footer of ${domain}`,
      `Find and return the selector for a Terms and Conditions or Customer Service link on ${domain}`,
    ];
    
    let returnPageData = null;
    let usedPromptIndex = -1;
    
    // Try to navigate to return-specific pages
    for (let i = 0; i < returnLinkPrompts.length; i++) {
      try {
        console.log(`[${domain}] Attempting to find return link (attempt ${i + 1})...`);
        const obsResult = await page.observe({ instruction: returnLinkPrompts[i] });
        
        if (obsResult && Array.isArray(obsResult) && obsResult.length > 0 && obsResult[0]?.selector) {
          const observed = obsResult[0];
          console.log(`[${domain}] Found return link, clicking...`);
          
          // Click the return link
          await page.act({
            description: `Click the return/refund link for ${domain}`,
            method: 'click',
            arguments: [],
            selector: observed.selector
          });
          
          // Wait a bit for page load
          await page.waitForTimeout(3000);
          
          // Extract data from the return page
          console.log(`[${domain}] Extracting return information from dedicated page...`);
          returnPageData = await page.extract({
            instruction: `Extract all return information including return periods, methods, costs, conditions, and procedures for returning products to ${domain}`,
            schema: returnSchema
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
    
    // If we found return page data, use it
    if (returnPageData) {
      console.log(`[${domain}] Successfully extracted from return page (method ${usedPromptIndex + 1})`);
      return returnPageData;
    }
    
    // Step 3: Try to find additional return information on homepage
    console.log(`[${domain}] No dedicated return page found, extracting from homepage...`);
    
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
            instruction: `Extract any return-related information from this page for ${domain}`,
            schema: returnSchema
          });
          
          // Go back to homepage
          await page.goBack();
          await page.waitForTimeout(2000);
          
          // Merge with homepage data
          returnPageData = additionalData;
          break;
        }
      } catch (err) {
        console.warn(`[${domain}] Additional info extraction failed:`, err);
      }
    }
    
    // Step 4: Final extraction from homepage
    console.log(`[${domain}] Performing final extraction from homepage...`);
    const homepageData = await page.extract({
      instruction: `Extract all return information including return periods, methods, costs, conditions, and procedures for returning products to ${domain}. If no specific return information is found, indicate this clearly.`,
      schema: returnSchema
    });
    
    // Merge data if we have both
    if (returnPageData) {
      // Merge the data, preferring returnPageData for specific fields
      const mergedData = { ...homepageData, ...returnPageData };
      console.log(`[${domain}] Return extraction completed with merged data.`);
      return mergedData;
    } else {
      console.log(`[${domain}] Return extraction completed from homepage only.`);
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
  const resultData: Record<string, any> = {};
  const allDomains = new Set<string>();
  
  // Collect all successful JSONs
  for (const file of files) {
    if (file.startsWith('return-info-') && file.endsWith('.json') && !file.startsWith('return-info-ALL-SITES')) {
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
  
  const outPath = path.join(RESULT_DIR, `return-info-ALL-SITES.json`);
  await fs.writeFile(outPath, JSON.stringify(orderedResult, null, 2), 'utf-8');
  console.log(`Aggregated all site results to ${outPath}`);
}

async function main() {
  await ensureResultDir();
  
  // Get domain from command line arguments (as passed by run-returns-batches.sh)
  const domains = process.argv.slice(2);
  if (domains.length === 0) {
    // Ha nincs argumentum, aggregáljunk!
    console.log('No domain argument provided, aggregating all results...');
    await aggregateResults();
    return;
  }
  
  // Process single domain (as called by run-returns-batches.sh)
  const domain = domains[0];
  const outFile = path.join(RESULT_DIR, `return-info-${domain}-${getTimestamp()}.json`);
  
  console.log(`Processing: ${domain}`);
  const data = await retryProcessDomain(domain, 3);
  await fs.writeFile(outFile, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Result for ${domain} written to ${outFile}`);

  // Minden domain után aggregálj!
  await aggregateResults();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
}); 