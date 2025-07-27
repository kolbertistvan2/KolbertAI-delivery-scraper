import { Stagehand, type ConstructorParams } from "@browserbasehq/stagehand";
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as util from 'util';
import { extractCountryFromDomain, getOptimalRegion } from './region-mapping';
import { executeNavigationStrategy, directNavigate } from './direct-navigation';

// Function to merge extracted data from multiple pages
function mergeExtractedData(extractedData: any[], domain: string): any {
  if (extractedData.length === 0) return null;
  
  console.log(`[${domain}] Merging data from ${extractedData.length} pages...`);
  
  // Sort pages by priority: terms > return > faq > homepage
  const pagePriority = {
    'terms': 4,
    'terms-page': 4,
    'return': 3,
    'return-page': 3,
    'faq': 2,
    'faq-page': 2,
    'homepage': 1
  };
  
  // Sort extracted data by priority
  const sortedData = extractedData.sort((a, b) => {
    const priorityA = pagePriority[a.page as keyof typeof pagePriority] || 0;
    const priorityB = pagePriority[b.page as keyof typeof pagePriority] || 0;
    return priorityB - priorityA; // Higher priority first
  });
  
  console.log(`[${domain}] Sorted pages by priority:`, sortedData.map(d => d.page));
  
  // Start with the highest priority page's data as base
  const mergedData = { ...sortedData[0].data };
  
  // Merge additional data from other pages (lower priority)
  for (let i = 1; i < sortedData.length; i++) {
    const pageData = sortedData[i].data;
    const pageType = sortedData[i].page;
    
    console.log(`[${domain}] Merging data from ${pageType} page (priority ${pagePriority[pageType as keyof typeof pagePriority] || 0})...`);
    
    // Merge each field, preferring HIGHER PRIORITY pages and English over local language
    Object.keys(pageData).forEach(key => {
      if (key === 'website') return; // Skip website field
      
      if (pageData[key] && typeof pageData[key] === 'object') {
        // Handle nested objects (like IN_STORE_RETURN, etc.)
        Object.keys(pageData[key]).forEach(nestedKey => {
          const currentValue = mergedData[key]?.[nestedKey];
          const newValue = pageData[key][nestedKey];
          
          // Prefer English values over local language
          const isCurrentEnglish = isEnglishValue(currentValue);
          const isNewEnglish = isEnglishValue(newValue);
          
          // Replace if new value exists and either:
          // 1. Current value is empty/null, OR
          // 2. New value is English and current is not, OR  
          // 3. This is from the highest priority page (terms page only)
          const isHighestPriorityPage = pagePriority[pageType as keyof typeof pagePriority] === 4; // terms page only
          
          if (newValue && newValue !== 'null' && newValue !== '' && 
              (!currentValue || currentValue === 'null' || currentValue === '' || 
               (isNewEnglish && !isCurrentEnglish) ||
               isHighestPriorityPage)) {
            if (!mergedData[key]) mergedData[key] = {};
            mergedData[key][nestedKey] = newValue;
            console.log(`[${domain}] Updated ${key}.${nestedKey} from ${pageType} (priority ${pagePriority[pageType as keyof typeof pagePriority] || 0}): "${newValue}"`);
          }
        });
      } else {
        // Handle simple fields
        const currentValue = mergedData[key];
        const newValue = pageData[key];
        
        // Prefer English values over local language
        const isCurrentEnglish = isEnglishValue(currentValue);
        const isNewEnglish = isEnglishValue(newValue);
        
        // Replace if new value exists and either:
        // 1. Current value is empty/null, OR
        // 2. New value is English and current is not, OR  
        // 3. This is from the highest priority page (terms page only)
        const isHighestPriorityPage = pagePriority[pageType as keyof typeof pagePriority] === 4; // terms page only
        
        if (newValue && newValue !== 'null' && newValue !== '' && 
            (!currentValue || currentValue === 'null' || currentValue === '' || 
             (isNewEnglish && !isCurrentEnglish) ||
             isHighestPriorityPage)) {
          mergedData[key] = newValue;
          console.log(`[${domain}] Updated ${key} from ${pageType} (priority ${pagePriority[pageType as keyof typeof pagePriority] || 0}): "${newValue}"`);
        }
      }
    });
  }
  
  console.log(`[${domain}] Data merging completed with priority-based approach`);
  return mergedData;
}



// Helper function to check if a value is in English
function isEnglishValue(value: any): boolean {
  if (!value || typeof value !== 'string') return false;
  
  // Check for common non-English words (expanded for Czech and other languages)
  const nonEnglishPatterns = [
    // Yes/No in various languages
    /ano|ne|ja|nein|oui|non|sí|no|tak|nie|igen|nem|da|nu|evet|hayır/i,
    
    // Free/Cost in various languages
    /zdarma|gratis|gratuit|gratuito|ingyenes|bezplatně|ingyenesen|darmo|za darmo/i,
    
    // Time periods in various languages
    /dní|dnů|nap|napot|tag|tage|jour|giorno|día|dzień|nap|gün|napja|napot|dni|dny/i,
    
    // Czech specific words
    /nepoužité|použité|zboží|objednávka|vrácení|reklamace|podmínky|doprava|platba/i,
    
    // Other common non-English words
    /možnost|služba|informace|kontakt|pomoc|podpora|účet|heslo|přihlášení|registrace/i
  ];
  
  return !nonEnglishPatterns.some(pattern => pattern.test(value));
}

if (!process.env.BROWSERBASE_API_KEY) {
  throw new Error('BROWSERBASE_API_KEY is missing! Cloud session cannot start.');
}

const RESULT_DIR = 'result-returns-v2-director';

// Return schema (same as original)
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

// Load prompt template
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

async function handleCookieConsent(page: any, domain: string): Promise<void> {
  try {
    console.log(`[${domain}] Attempting to handle cookie consent...`);
    
    // Common cookie consent button texts in different languages
    const cookieButtonTexts = [
      "Accept all cookies",
      "Accept cookies", 
      "Accept",
      "OK",
      "I agree",
      "Agree",
      "Allow all",
      "Allow",
      "Continue",
      "Proceed",
      "V pořádku", // Czech
      "Jen ty nezbytné", // Czech - only necessary
      "Akceptovat", // Czech
      "Souhlasím", // Czech
      "Pokračovat", // Czech
      "Zapnout vše", // Czech
      "Přijmout", // Czech
      "OK", // Czech
      "Rozumím", // Czech
      "Zapnout", // Czech
    ];
    
    // Try to find and click cookie consent buttons
    for (const buttonText of cookieButtonTexts) {
      try {
        const obsResult = await page.observe(`Find and click the "${buttonText}" button to accept cookies or close cookie dialog`);
        
        if (obsResult && Array.isArray(obsResult) && obsResult.length > 0 && obsResult[0]?.selector) {
          console.log(`[${domain}] Found cookie button: "${buttonText}", clicking...`);
          await page.act({
            description: `Click cookie consent button: ${buttonText}`,
            method: 'click',
            arguments: [],
            selector: obsResult[0].selector
          });
          await page.waitForTimeout(2000);
          console.log(`[${domain}] Cookie consent handled successfully`);
          return;
        }
      } catch (err) {
        // Continue to next button text
        continue;
      }
    }
    
    // If no specific button found, try generic cookie handling
    try {
      const obsResult = await page.observe("Find any cookie consent, privacy notice, or popup dialog and close or accept it");
      
      if (obsResult && Array.isArray(obsResult) && obsResult.length > 0 && obsResult[0]?.selector) {
        console.log(`[${domain}] Found generic cookie dialog, handling...`);
        await page.act({
          description: "Close or accept cookie dialog",
          method: 'click',
          arguments: [],
          selector: obsResult[0].selector
        });
        await page.waitForTimeout(2000);
        console.log(`[${domain}] Generic cookie dialog handled`);
        return;
      }
    } catch (err) {
      console.log(`[${domain}] No cookie dialog found or already handled`);
    }
    
  } catch (err) {
    console.warn(`[${domain}] Cookie handling failed:`, err);
  }
}

async function robustGoto(stagehandRef: { stagehand: Stagehand }, url: string, domain: string, maxRetries = 3): Promise<void> {
  let attempt = 0;
  let lastError: any = null;
  while (attempt < maxRetries) {
    try {
      console.log(`[${domain}] [Goto attempt ${attempt + 1}] Navigating to: ${url}`);
      await stagehandRef.stagehand.page.goto(url);
      
      // Handle cookie consent after navigation
      await handleCookieConsent(stagehandRef.stagehand.page, domain);
      
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
    console.log(`[${domain}] Starting Director.ai-style return information extraction...`);
    
    // Set up region based on domain
    const country = extractCountryFromDomain(domain);
    const region = getOptimalRegion(country);
    process.env.BROWSERBASE_REGION = region;
    console.log(`[${domain}] Set BROWSERBASE_REGION to: ${region}`);
    
    console.log(`[${domain}] Initializing Stagehand with fresh session...`);
    stagehand = new Stagehand(stagehandConfig(domain));
    await stagehand.init();
    console.log(`[${domain}] Stagehand initialized successfully with new session.`);
    const page = stagehand.page;
    if (!page) throw new Error("Failed to get page instance from Stagehand");

    // Load and process prompt template
    console.log(`[${domain}] Loading prompt from prompt-return.txt...`);
    const promptTemplate = await loadPrompt();
    const variables = { website: domain, country: 'Czechia' };
    const prompt = replacePromptVariables(promptTemplate, variables);
    
    // Step 1: Navigate to homepage (Director.ai style)
    console.log(`[${domain}] Step 1: Navigate to homepage...`);
    const homepage = `https://${domain}`;
    const stagehandRef = { stagehand };
    await robustGoto(stagehandRef, homepage, domain);
    stagehand = stagehandRef.stagehand;
    const pageAfter = stagehand.page;
    if (!pageAfter) throw new Error("Failed to get page instance from Stagehand after restart");

    // Step 2: Search for return information in website locations (Director.ai style)
    console.log(`[${domain}] Step 2: Searching for return information in website locations...`);
    
    // Handle cookie consent first
    await handleCookieConsent(page, domain);
    
    // Scroll through the entire page to see all content
    console.log(`[${domain}] Scrolling through entire page to see all content...`);
    await page.act("Scroll through the entire page from top to bottom to see all content including footer");
    await page.waitForTimeout(3000);
    
    // Collect all return-related pages to visit
    const visitedPages: any[] = [];
    
    // Step 2a: Find footer links for returns, refunds, exchanges
    console.log(`[${domain}] Step 2a: Finding footer links for returns, refunds, exchanges...`);
    const footerLinkPrompts = [
      `Scroll to the footer and find links for returns, refunds, or complaints on ${domain}`,
      `Look at the bottom of the page for return policy or customer service links on ${domain}`,
      `Find footer links for returns, exchanges, or complaint procedures on ${domain}`,
      `Search the footer for links related to return policy, refunds, or customer service on ${domain}`,
    ];
    
    for (const footerPrompt of footerLinkPrompts) {
      try {
        const obsResult = await page.observe(footerPrompt);
        if (obsResult && Array.isArray(obsResult) && obsResult.length > 0 && obsResult[0]?.selector) {
          console.log(`[${domain}] Found return link in footer, clicking...`);
          
          // Click the return link
          await page.act({
            description: `Click the return/refund link found in footer for ${domain}`,
            method: 'click',
            arguments: [],
            selector: obsResult[0].selector
          });
          
          // Wait for page load and scroll through it
          await page.waitForTimeout(5000);
          await page.act("Scroll through the entire page to see all return information");
          await page.waitForTimeout(2000);
          
          // Get page text for later extraction
          const pageText = await page.extract({ instruction: "Get all text content from this page" });
          visitedPages.push({ page: 'return-page', text: pageText });
          
          // Go back to homepage
          await page.goBack();
          await page.waitForTimeout(3000);
          await page.act("Scroll to the bottom of the page to see footer links");
          await page.waitForTimeout(2000);
          break;
        }
      } catch (err) {
        console.warn(`[${domain}] Footer link attempt failed:`, err);
      }
    }
    
    // Step 2b: Find Terms & Conditions page
    console.log(`[${domain}] Step 2b: Finding Terms & Conditions page...`);
    const termsPrompts = [
      `Find and click on terms and conditions links on ${domain}`,
      `Find and click on obchodní podmínky or terms links on ${domain}`,
      `Find and click on legal terms or conditions links on ${domain}`,
    ];
    
    for (const termsPrompt of termsPrompts) {
      try {
        const obsResult = await page.observe(termsPrompt);
        if (obsResult && Array.isArray(obsResult) && obsResult.length > 0 && obsResult[0]?.selector) {
          console.log(`[${domain}] Found terms link, clicking...`);
          
          await page.act({
            description: `Click the terms and conditions link for ${domain}`,
            method: 'click',
            arguments: [],
            selector: obsResult[0].selector
          });
          
          await page.waitForTimeout(5000);
          await page.act("Scroll through the entire page to see all terms information");
          await page.waitForTimeout(2000);
          
          // Get page text for later extraction
          const pageText = await page.extract({ instruction: "Get all text content from this page" });
          visitedPages.push({ page: 'terms-page', text: pageText });
          
          // Go back to homepage
          await page.goBack();
          await page.waitForTimeout(3000);
          await page.act("Scroll to the bottom of the page to see footer links");
          await page.waitForTimeout(2000);
          break;
        }
      } catch (err) {
        console.warn(`[${domain}] Terms page attempt failed:`, err);
      }
    }
    
    // Step 2c: Find FAQ or help pages
    console.log(`[${domain}] Step 2c: Finding FAQ or help pages...`);
    const faqPrompts = [
      `Find and click on FAQ or help links on ${domain}`,
      `Find and click on customer service or contact links on ${domain}`,
      `Find and click on support or assistance links on ${domain}`,
    ];
    
    for (const faqPrompt of faqPrompts) {
      try {
        const obsResult = await page.observe(faqPrompt);
        if (obsResult && Array.isArray(obsResult) && obsResult.length > 0 && obsResult[0]?.selector) {
          console.log(`[${domain}] Found FAQ link, clicking...`);
          
          await page.act({
            description: `Click the FAQ or help link for ${domain}`,
            method: 'click',
            arguments: [],
            selector: obsResult[0].selector
          });
          
          await page.waitForTimeout(5000);
          await page.act("Scroll through the entire page to see all FAQ information");
          await page.waitForTimeout(2000);
          
          // Get page text for later extraction
          const pageText = await page.extract({ instruction: "Get all text content from this page" });
          visitedPages.push({ page: 'faq-page', text: pageText });
          
          // Go back to homepage
          await page.goBack();
          await page.waitForTimeout(3000);
          await page.act("Scroll to the bottom of the page to see footer links");
          await page.waitForTimeout(2000);
          break;
        }
      } catch (err) {
        console.warn(`[${domain}] FAQ page attempt failed:`, err);
      }
    }
    
    // Step 3: Final extraction from homepage with all collected context
    console.log(`[${domain}] Step 3: Performing final extraction from homepage with all collected context...`);
    
    // Scroll through entire page one more time
    await page.act("Scroll through the entire page from top to bottom to see all content");
    await page.waitForTimeout(3000);
    
    // Get homepage text
    const homepageText = await page.extract({ instruction: "Get all text content from this homepage" });
    visitedPages.push({ page: 'homepage', text: homepageText });
    
    // Step 4: Director.ai-style single extraction with all collected data
    console.log(`[${domain}] Step 4: Performing Director.ai-style single extraction with all collected data...`);
    console.log(`[${domain}] Visited ${visitedPages.length} pages: ${visitedPages.map(p => p.page).join(', ')}`);
    
    // Create comprehensive extraction prompt with all collected data
    const comprehensivePrompt = `${prompt}

COLLECTED DATA FROM VISITED PAGES:
${visitedPages.map((page, index) => `
PAGE ${index + 1} (${page.page}):
${page.text}
`).join('\n')}

Based on ALL the collected data from the visited pages above, extract the complete return information for ${domain}. Use the information from all pages to provide the most comprehensive and accurate response.`;
    
    // Single extraction with all collected data
    const finalData = await page.extract({
      instruction: comprehensivePrompt,
      schema: returnSchema
    });
    
    console.log(`[${domain}] Director.ai-style extraction completed with data from ${visitedPages.length} pages.`);
    return finalData;
    
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
      if (result) {
        console.log(`[${domain}] Success on attempt ${attempt}`);
        return result;
      }
    } catch (err) {
      console.error(`[${domain}] Attempt ${attempt} failed:`, err);
      // Wait a bit before next attempt
      if (attempt < maxRetries) {
        console.log(`[${domain}] Waiting 5 seconds before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
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
        const content = await fs.readFile(filePath, 'utf-8');
        const domainMatch = content.match(/\[([^\]]+)\]/);
        if (domainMatch) {
          const domain = domainMatch[1];
          allDomains.add(domain);
          if (!resultData[domain]) {
            resultData[domain] = { error: content };
          }
        }
      } catch (e) {
        console.warn(`Failed to read log file ${file}:`, e);
      }
    }
  }
  
  // Read websites.txt to maintain order
  const websitesPath = path.join(process.cwd(), 'websites.txt');
  let orderedDomains: string[] = [];
  try {
    const websitesContent = await fs.readFile(websitesPath, 'utf-8');
    orderedDomains = websitesContent.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(line => line.replace(/^https?:\/\//, '').replace(/\/.*$/, ''));
  } catch (e) {
    console.warn('Failed to read websites.txt, using alphabetical order');
    orderedDomains = Array.from(allDomains).sort();
  }
  
  // Create ordered result maintaining websites.txt order
  const orderedResult: Record<string, any> = {};
  for (const domain of orderedDomains) {
    if (resultData[domain]) {
      orderedResult[domain] = resultData[domain];
    }
  }
  
  // Add any remaining domains not in websites.txt
  for (const domain of Array.from(allDomains)) {
    if (!orderedResult[domain]) {
      orderedResult[domain] = resultData[domain];
    }
  }
  
  // Write aggregated results
  const timestamp = getTimestamp();
  const allSitesFile = path.join(RESULT_DIR, `return-info-ALL-SITES-${timestamp}.json`);
  await fs.writeFile(allSitesFile, JSON.stringify(orderedResult, null, 2), 'utf-8');
  
  console.log(`✅ Aggregated results written to: ${allSitesFile}`);
  console.log(`📊 Total domains processed: ${Object.keys(orderedResult).length}`);
  console.log(`✅ Successful extractions: ${Object.keys(orderedResult).filter(d => !orderedResult[d].error).length}`);
  console.log(`❌ Failed extractions: ${Object.keys(orderedResult).filter(d => orderedResult[d].error).length}`);
  
  return orderedResult;
}

async function main() {
  const command = process.argv[2];
  
  if (!command) {
    console.error('Usage: node extract-returns-v2.js <domain> or node extract-returns-v2.js aggregate');
    process.exit(1);
  }
  
  // Handle help command
  if (command === '--help' || command === '-h') {
    console.log(`
🚀 KolbertAI Return Information Extractor v3.0.0

Usage:
  node extract-returns-v2.js <domain>     - Extract return info for a specific domain
  node extract-returns-v2.js aggregate    - Aggregate all existing results
  node extract-returns-v2.js --help       - Show this help message

Examples:
  node extract-returns-v2.js alza.cz
  node extract-returns-v2.js aggregate

Environment Variables:
  GOOGLE_API_KEY          - Google AI API key
  BROWSERBASE_API_KEY     - Browserbase API key  
  BROWSERBASE_PROJECT_ID  - Browserbase project ID

Output:
  Results are saved to result-returns-v2/ directory
`);
    process.exit(0);
  }
  
  await ensureResultDir();
  
  if (command === 'aggregate') {
    console.log(`🚀 Starting aggregation of all results...`);
    await aggregateResults();
  } else {
    const domain = command;
    console.log(`🚀 Starting return information extraction for: ${domain}`);
    
    const result = await retryProcessDomain(domain);
    
    if (result) {
      const timestamp = getTimestamp();
      const resultFile = path.join(RESULT_DIR, `return-info-${domain}-${timestamp}.json`);
      await fs.writeFile(resultFile, JSON.stringify(result, null, 2), 'utf-8');
      console.log(`✅ Results written to: ${resultFile}`);
    } else {
      console.error(`❌ Failed to extract return information for: ${domain}`);
      process.exit(1);
    }
  }
}

// ES module main check
if (process.argv[1] && process.argv[1].endsWith('extract-returns-v2-director.ts')) {
  // Handle uncaught exceptions to prevent crashes from shared_worker errors
  process.on('uncaughtException', (error) => {
    if (error.message.includes('shared_worker') || error.message.includes('targetInfo')) {
      console.warn('Ignoring shared_worker error:', error.message);
      return;
    }
    console.error('Uncaught exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    if (reason && typeof reason === 'object' && 'message' in reason) {
      const message = (reason as any).message;
      if (message.includes('shared_worker') || message.includes('targetInfo')) {
        console.warn('Ignoring shared_worker rejection:', message);
        return;
      }
    }
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });

  main().catch(console.error);
}

export default main; 