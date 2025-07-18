import { Stagehand, type ConstructorParams } from "@browserbasehq/stagehand";
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import util from 'util';

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

    // Step 2: Multi-stage observe fallback with dynamic prompts
    const fallbackPrompts = [
      prompt,
      replacePromptVariables(`Find and return the selector for a footer link related to returns or refunds on the homepage of ${domain}.`, { website: domain }),
      replacePromptVariables(`Find and return the selector for a FAQ section or link related to returns or refunds on the homepage of ${domain}.`, { website: domain }),
      replacePromptVariables(`Find and return the selector for a Terms and Conditions link on the homepage of ${domain}.`, { website: domain }),
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
      console.log(`[${domain}] Clicking observed return/refund/exchange link...`);
      await page.act({
        description: `Click the observed return/refund/exchange link for ${domain}`,
        method: 'click',
        arguments: [],
        selector: observed.selector
      });
      
      // Step 4: Extract return info
      console.log(`[${domain}] Extracting return information...`);
      const extractedData = await page.extract({
        instruction: prompt,
        schema: returnSchema
      });
      console.log(`[${domain}] Return extraction completed successfully.`);
      return extractedData;
    } else {
      // Fallback: extract directly from homepage
      console.log(`[${domain}] No link found in any observe stage, extracting directly from homepage...`);
      const extractedData = await page.extract({
        instruction: prompt,
        schema: returnSchema
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
    if (file.startsWith('return-info-') && file.endsWith('.json') && !file.startsWith('return-info-ALL-SITES')) {
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
  const outPath = path.join(RESULT_DIR, `return-info-ALL-SITES.json`);
  await fs.writeFile(outPath, JSON.stringify(result, null, 2), 'utf-8');
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