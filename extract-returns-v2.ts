import { Stagehand, type ConstructorParams } from "@browserbasehq/stagehand";
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as util from 'util';
import { config } from 'dotenv';
import { extractCountryFromDomain, getOptimalRegion } from './region-mapping';
import { executeNavigationStrategy, directNavigate } from './direct-navigation';

// Load environment variables from .env file
config();

// Function to merge extracted data from multiple pages
async function mergeExtractedData(extractedData: any[], domain: string): Promise<any> {
  if (extractedData.length === 0) return null;
  
  console.log(`[${domain}] Merging data from ${extractedData.length} pages with simple union approach...`);
  
  // Start with empty data structure
  let mergedData: any = {
    website: '',
    IN_STORE_RETURN: { available: 'not available', locations: 'not available', time_limit: 'not available', conditions: 'not available' },
    HOME_COLLECTION: { available: 'not available', providers: 'not available', cost: 'not available', time_limit: 'not available', conditions: 'not available' },
    DROP_OFF_PARCEL_SHOP: { available: 'not available', providers: 'not available', cost: 'not available', time_limit: 'not available' },
    DROP_OFF_PARCEL_LOCKER: { available: 'not available', providers: 'not available', cost: 'not available', time_limit: 'not available' },
    FREE_RETURN: { available: 'not available', conditions: 'not available', methods: 'not available' },
    QR_CODE_BARCODE_PIN: { available: 'not available', usage: 'not available', providers: 'not available' },
    EXTERNAL_RETURN_PORTAL: { available: 'not available', url: 'not available', features: 'not available' },
    SUMMARY: ''
  };
  
  // Simple union merge - collect all information from all sources
  extractedData.forEach((data, index) => {
    const pageData = data.data;
    const pageType = data.page;
    
    console.log(`[${domain}] Processing data from ${pageType} page...`);
    
    // Set website from first source
    if (index === 0) {
      mergedData.website = pageData.website || '';
    }
    
    // Merge each category - simple union approach
    Object.keys(pageData).forEach(key => {
      if (key === 'website') return; // Skip website field
      
      if (pageData[key] && typeof pageData[key] === 'object') {
        // Handle nested objects (like IN_STORE_RETURN, etc.)
        Object.keys(pageData[key]).forEach(nestedKey => {
          const currentValue = mergedData[key]?.[nestedKey];
          const newValue = pageData[key][nestedKey];
          
          // Skip if new value is empty
          if (!newValue || newValue === 'null' || newValue === '' || newValue === 'not available') return;
          
          // If merged value is empty, use new value
          if (!currentValue || currentValue === 'null' || currentValue === '' || currentValue === 'not available') {
            if (!mergedData[key]) mergedData[key] = {};
            mergedData[key][nestedKey] = newValue;
            console.log(`[${domain}] Added ${key}.${nestedKey} from ${pageType}: "${newValue}"`);
          } else if (Array.isArray(currentValue) && Array.isArray(newValue)) {
            // Merge arrays, removing duplicates
            const mergedArray = [...new Set([...currentValue, ...newValue])];
            mergedData[key][nestedKey] = mergedArray;
            console.log(`[${domain}] Merged arrays for ${key}.${nestedKey} from ${pageType}`);
          } else if (typeof currentValue === 'string' && typeof newValue === 'string') {
            // If both have content and different, combine them
            if (currentValue !== newValue) {
              const combined = `${currentValue}. ${newValue}`;
              mergedData[key][nestedKey] = combined;
              console.log(`[${domain}] Combined ${key}.${nestedKey} from ${pageType}`);
            }
          }
        });
      } else {
        // Handle simple fields
        const currentValue = mergedData[key];
        const newValue = pageData[key];
        
        // Skip if new value is empty
        if (!newValue || newValue === 'null' || newValue === '' || newValue === 'not available') return;
        
        // If merged value is empty, use new value
        if (!currentValue || currentValue === 'null' || currentValue === '' || currentValue === 'not available') {
          mergedData[key] = newValue;
          console.log(`[${domain}] Added ${key} from ${pageType}: "${newValue}"`);
        } else if (typeof currentValue === 'string' && typeof newValue === 'string') {
          // If both have content and different, combine them
          if (currentValue !== newValue) {
            const combined = `${currentValue}. ${newValue}`;
            mergedData[key] = combined;
            console.log(`[${domain}] Combined ${key} from ${pageType}`);
          }
        }
      }
    });
  });
  
  console.log(`[${domain}] Simple union merge completed`);
  
  // Use LLM to clean and structure the merged data
  console.log(`[${domain}] Using LLM to clean and structure data...`);
  const cleanedData = await cleanDataWithLLM(mergedData, domain);
  
  return cleanedData;
}

// Function to clean and structure data using LLM
async function cleanDataWithLLM(data: any, domain: string): Promise<any> {
  console.log(`[${domain}] Cleaning data with LLM...`);
  
  try {
    // Create a prompt for the LLM to clean the data
    const cleaningPrompt = `You are a data cleaning expert. Clean and structure the following return policy data for ${domain}.

CRITICAL REQUIREMENTS:
1. Remove all duplicates and redundant information
2. Resolve any contradictions (use the most common/reliable information)
3. Standardize values (e.g., "yes"/"no", consistent time formats)
4. Keep only confirmed, accurate information
5. Maintain the exact JSON structure
6. All text must be in English
7. Remove any "not available" fields that have actual data

DATA TO CLEAN:
${JSON.stringify(data, null, 2)}

Return a clean, structured JSON with the same format. Remove duplicates, resolve contradictions, and standardize the data.`;

    // Use Google AI to clean the data with Gemini 2.5 Flash Preview
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-05-20' });
    
    const result = await model.generateContent(cleaningPrompt);
    const response = await result.response;
    const cleanedText = response.text();
    
    // Extract JSON from the response
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn(`[${domain}] Could not extract JSON from LLM response, using original data`);
      return data;
    }
    
    const cleanedData = JSON.parse(jsonMatch[0]);
    console.log(`[${domain}] Data cleaned successfully with LLM`);
    
    return cleanedData;
    
  } catch (error) {
    console.warn(`[${domain}] Failed to clean data with LLM:`, (error as Error).message);
    console.warn(`[${domain}] Using original merged data`);
    return data;
  }
}

// Helper function to fix invalid URLs
function fixInvalidUrls(data: any): any {
  const fixedData = { ...data };
  
  // Check EXTERNAL_RETURN_PORTAL.url field
  if (fixedData.EXTERNAL_RETURN_PORTAL?.url) {
    const url = fixedData.EXTERNAL_RETURN_PORTAL.url;
    
    // Check if it's an invalid URL (numbers, internal IDs, etc.)
    if (typeof url === 'string' && (
      /^\d+$/.test(url) || // Just numbers
      /^0-\d+$/.test(url) || // "0-1234" format
      /^link-\d+$/.test(url) || // "link-1" format
      !url.includes('.') || // No domain extension
      url.length < 10 // Too short to be a real URL
    )) {
      fixedData.EXTERNAL_RETURN_PORTAL.url = "not available";
    }
  }
  
  return fixedData;
}

// Director.ai approach: process all collected data with single LLM call
async function processAllCollectedData(allData: any[], domain: string, prompt: string): Promise<any> {
  console.log(`[${domain}] Processing all collected data with LLM...`);
  
  // Create a comprehensive prompt for the LLM to process all data
  const comprehensivePrompt = `You have collected return information from multiple pages of ${domain}. 

Here is all the collected data from different pages:
${JSON.stringify(allData, null, 2)}

Based on ALL this collected information, create a single, comprehensive JSON response that includes the most accurate and complete return information.

IMPORTANT RULES:
1. Use ALL available information from ALL pages
2. Prefer more detailed information over less detailed
3. If there are conflicts, choose the most specific/complete information
4. All text must be in English (except company names, brand names, place names)
5. For URLs: only include actual website URLs, not internal IDs or numbers
6. Fill in missing information where possible based on context

${prompt}`;

  try {
    // Use Google AI to process all data
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-05-20' });
    
    const result = await model.generateContent(comprehensivePrompt);
    const response = await result.response;
    const processedText = response.text();
    
    // Try to parse the processed JSON
    try {
      const processedData = JSON.parse(processedText);
      console.log(`[${domain}] Successfully processed all data with LLM`);
      return processedData;
    } catch (parseError) {
      console.warn(`[${domain}] Failed to parse LLM response, using fallback merge`);
      // Fallback to simple merge if LLM parsing fails
      return mergeExtractedData(allData, domain);
    }
  } catch (error) {
    console.warn(`[${domain}] LLM processing failed, using fallback merge:`, error);
    // Fallback to simple merge if LLM fails
    return mergeExtractedData(allData, domain);
  }
}

// Helper function to check if a value is a valid URL
function isValidUrlValue(value: any): boolean {
  if (!value || typeof value !== 'string') return false;
  
  // Check if it's an invalid URL (numbers, internal IDs, etc.)
  if (/^\d+$/.test(value) || // Just numbers
      /^0-\d+$/.test(value) || // "0-1234" format
      /^link-\d+$/.test(value) || // "link-1" format
      !value.includes('.') || // No domain extension
      value.length < 10) { // Too short to be a real URL
    return false;
  }
  
  return true;
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

const RESULT_DIR = 'result-returns-v2';

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

async function createStagehandWithRetry(domain: string, maxRetries = 5): Promise<Stagehand> {
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[${domain}] [CDP] Attempt ${attempt}/${maxRetries} to create Stagehand session`);
      
      // Set region before creating Stagehand instance
      const country = extractCountryFromDomain(domain);
      const region = getOptimalRegion(country);
      process.env.BROWSERBASE_REGION = region;
      
      const stagehand = new Stagehand(stagehandConfig(domain));
      await stagehand.init();
      
      // Verify page instance exists
      const page = stagehand.page;
      if (!page) {
        throw new Error("Page instance is undefined after initialization");
      }
      
      console.log(`[${domain}] [CDP] Stagehand initialized successfully on attempt ${attempt}`);
      if (attempt > 1) {
        logSuccessfulRecovery(domain);
      }
      return stagehand;
      
    } catch (error: any) {
      lastError = error;
      console.error(`[${domain}] [CDP] Attempt ${attempt} failed:`, error.message);
      
      // Specific handling for CDP errors
      if (error.message.includes('CDP connection') || 
          error.message.includes('browser context is undefined') ||
          error.message.includes('StagehandInitError')) {
        
        logErrorStats(domain, 'cdp');
        console.log(`[${domain}] [CDP] CDP connection error detected, waiting before retry...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
        
        // Force cleanup
        try {
          if (error.stagehand) {
            await error.stagehand.close();
          }
        } catch (closeErr) {
          console.warn(`[${domain}] [CDP] Error during cleanup:`, closeErr);
        }
      } else if (error.message.includes('timeout') || error.message.includes('net::ERR_')) {
        logErrorStats(domain, 'network');
        console.log(`[${domain}] [CDP] Network error detected, waiting before retry...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      } else {
        logErrorStats(domain, 'other');
        console.log(`[${domain}] [CDP] Other error detected, waiting before retry...`);
        await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
      }
      
      if (attempt === maxRetries) {
        throw new Error(`[${domain}] Failed to initialize Stagehand after ${maxRetries} attempts. Last error: ${error.message}`);
      }
    }
  }
  
  throw lastError;
}

// Add monitoring and error tracking
const errorStats = {
  cdpErrors: 0,
  networkErrors: 0,
  timeoutErrors: 0,
  otherErrors: 0,
  totalRetries: 0,
  successfulRecoveries: 0
};

function logErrorStats(domain: string, errorType: string) {
  errorStats.totalRetries++;
  
  switch (errorType) {
    case 'cdp':
      errorStats.cdpErrors++;
      break;
    case 'network':
      errorStats.networkErrors++;
      break;
    case 'timeout':
      errorStats.timeoutErrors++;
      break;
    default:
      errorStats.otherErrors++;
  }
  
  console.log(`[${domain}] 📊 Error Stats: CDP=${errorStats.cdpErrors}, Network=${errorStats.networkErrors}, Timeout=${errorStats.timeoutErrors}, Other=${errorStats.otherErrors}, Total=${errorStats.totalRetries}`);
}

function logSuccessfulRecovery(domain: string) {
  errorStats.successfulRecoveries++;
  console.log(`[${domain}] 🎉 Successful recovery! Total recoveries: ${errorStats.successfulRecoveries}`);
}

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

async function translateToEnglish(data: any, domain: string): Promise<any> {
  console.log(`[${domain}] Translating data to English...`);
  
  // Check if data needs translation (contains non-English text)
  const needsTranslation = JSON.stringify(data).match(/[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/);
  if (!needsTranslation) {
    console.log(`[${domain}] Data already appears to be in English, skipping translation`);
    return data;
  }
  
  // Create a universal translation prompt
  const translationPrompt = `CRITICAL: Translate the following JSON data to English. Follow these strict rules:

1. KEEP ORIGINAL: Company names, brand names, place names, URLs, phone numbers
2. TRANSLATE TO ENGLISH: All descriptive text, conditions, procedures, time periods
3. FIX EMPTY FIELDS: Replace empty strings "" with "not available"
4. STANDARDIZE: Use "yes"/"no" consistently, not "Yes"/"no"
5. PRESERVE JSON STRUCTURE: Return ONLY valid JSON, no explanations or markdown

Translate all text values to English while preserving the JSON structure. Only company names, brand names, and place names should remain in their original language.

JSON DATA TO TRANSLATE:
${JSON.stringify(data, null, 2)}

Return ONLY the translated JSON with the same structure. All text values must be in English except company names, brand names, and place names.`;

  try {
    // Use Google AI to translate
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-05-20' });
    
    const result = await model.generateContent(translationPrompt);
    const response = await result.response;
    const translatedText = response.text();
    
    console.log(`[${domain}] Raw translation response:`, translatedText.substring(0, 200) + '...');
    
    // Try to parse the translated JSON
    try {
      // Clean up the response - remove markdown formatting if present
      let cleanText = translatedText.trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const translatedData = JSON.parse(cleanText);
      console.log(`[${domain}] Translation completed successfully`);
      return translatedData;
    } catch (parseError) {
      console.warn(`[${domain}] Failed to parse translated JSON:`, (parseError as Error).message);
      console.warn(`[${domain}] Using original data instead`);
      return data;
    }
  } catch (error) {
    console.warn(`[${domain}] Translation failed:`, error);
    console.warn(`[${domain}] Using original data instead`);
    return data;
  }
}

async function robustGoto(stagehandRef: { stagehand: Stagehand }, url: string, domain: string, maxRetries = 3): Promise<void> {
  let attempt = 0;
  let lastError: any = null;
  
  while (attempt < maxRetries) {
    try {
      console.log(`[${domain}] [Goto attempt ${attempt + 1}] Navigating to: ${url}`);
      
      // Check if page instance exists
      if (!stagehandRef.stagehand.page) {
        throw new Error("Page instance is undefined, need to reinitialize");
      }
      
      await stagehandRef.stagehand.page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      
      // Handle cookie consent after navigation
      await handleCookieConsent(stagehandRef.stagehand.page, domain);
      
      return;
    } catch (err: any) {
      lastError = err;
      console.warn(`⚠️ [${domain}] Goto error: ${err.message || err}`);
      
      // Specific handling for different error types
      if (err.message.includes('CDP connection') || 
          err.message.includes('browser context is undefined') ||
          err.message.includes('Page instance is undefined')) {
        
        console.log(`[${domain}] CDP/Page error detected, reinitializing Stagehand...`);
        
        try {
          await stagehandRef.stagehand.close();
        } catch (closeErr) {
          console.warn(`[${domain}] Error closing Stagehand during restart:`, closeErr);
        }
        
        // Use the new retry function
        const newStagehand = await createStagehandWithRetry(domain, 3);
        stagehandRef.stagehand = newStagehand;
        
      } else if (err.message.includes('timeout') || err.message.includes('net::ERR_')) {
        // Network errors - just retry with same instance
        console.log(`[${domain}] Network error, retrying with same instance...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
      }
      
      attempt++;
    }
  }
  throw lastError;
}

async function processDomain(domain: string) {
  let stagehand: Stagehand | null = null;
  try {
    console.log(`[${domain}] Initializing Stagehand with robust retry logic...`);
    stagehand = await createStagehandWithRetry(domain, 5);
    console.log(`[${domain}] Stagehand initialized successfully with robust session.`);
    
    const page = stagehand.page;
    if (!page) throw new Error("Failed to get page instance from Stagehand");

    // Load and process prompt template
    console.log(`[${domain}] Loading prompt from prompt-return.txt...`);
    const promptTemplate = await loadPrompt();
    const variables = { website: domain, country: 'Czechia' };
    const prompt = replacePromptVariables(promptTemplate, variables);
    
    // Step 1: Goto homepage (robust)
    const homepage = `https://${domain}`;
    const stagehandRef = { stagehand };
    await robustGoto(stagehandRef, homepage, domain);
    stagehand = stagehandRef.stagehand;
    const pageAfter = stagehand.page;
    if (!pageAfter) throw new Error("Failed to get page instance from Stagehand after restart");

    // Step 2: Director.ai-style direct navigation strategy
    console.log(`[${domain}] Starting Director.ai-style direct navigation strategy...`);
    
    // First, scroll through the entire page to see all content
    console.log(`[${domain}] Scrolling through entire page to see all content...`);
    await page.act("Scroll through the entire page from top to bottom to see all content including footer");
    await page.waitForTimeout(3000); // Wait for content to load
    
    // Try the new direct navigation strategy first
    console.log(`[${domain}] Attempting direct navigation strategy...`);
    let navigationResult = await executeNavigationStrategy(page, domain, returnSchema);
    
    if (navigationResult.success && navigationResult.data.length > 0) {
      console.log(`[${domain}] Direct navigation strategy successful, processing extracted data...`);
      
      // Director.ai approach: collect all data and let LLM decide final JSON
      const allCollectedData = navigationResult.data;
      console.log(`[${domain}] Collected data from ${allCollectedData.length} pages, processing with LLM...`);
      
      // Process all collected data with a single LLM call
      const finalData = await processAllCollectedData(allCollectedData, domain, prompt);
      
      if (finalData) {
        console.log(`[${domain}] Successfully processed all collected data with LLM`);
        return finalData;
      }
    }
    
    // Fallback: Try traditional observe-based navigation
    console.log(`[${domain}] Direct navigation failed, trying traditional observe-based navigation...`);
    
    // Try to find return-related links with footer focus
    const footerLinkPrompts = [
      `Scroll to the footer and find links for returns, refunds, or complaints on ${domain}`,
      `Look at the bottom of the page for return policy or customer service links on ${domain}`,
      `Find footer links for returns, exchanges, or complaint procedures on ${domain}`,
      `Search the footer for links related to return policy, refunds, or customer service on ${domain}`,
    ];
    
    let returnPageData = null;
    let usedPromptIndex = -1;
    
    // Try to navigate to return-specific pages from footer
    for (let i = 0; i < footerLinkPrompts.length; i++) {
      try {
        console.log(`[${domain}] Attempting to find return link in footer (attempt ${i + 1})...`);
        const obsResult = await page.observe(footerLinkPrompts[i]);
        
        if (obsResult && Array.isArray(obsResult) && obsResult.length > 0 && obsResult[0]?.selector) {
          const observed = obsResult[0];
          console.log(`[${domain}] Found return link in footer, clicking...`);
          
          // Click the return link
          await page.act({
            description: `Click the return/refund link found in footer for ${domain}`,
            method: 'click',
            arguments: [],
            selector: observed.selector
          });
          
          // Wait for page load and scroll through it
          await page.waitForTimeout(5000); // Longer wait like Director.ai
          await page.act("Scroll through the entire page to see all return information");
          await page.waitForTimeout(2000);
          
          // Extract data from the return page using V2 prompt
          console.log(`[${domain}] Extracting return information from dedicated page...`);
          returnPageData = await page.extract({
            instruction: prompt,
            schema: returnSchema
          });
          
          usedPromptIndex = i;
          break;
        }
      } catch (err) {
        console.warn(`[${domain}] Footer attempt ${i + 1} failed:`, err);
        // Try to go back to homepage if we navigated away
        try {
          await page.goBack();
          await page.waitForTimeout(3000);
          // Scroll back to footer
          await page.act("Scroll to the bottom of the page to see footer links");
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
    
    // Step 3: Try to find additional return information on homepage with better scrolling
    console.log(`[${domain}] No dedicated return page found, extracting from homepage with enhanced scrolling...`);
    
    // Scroll to different sections of the homepage
    const scrollPrompts = [
      "Scroll to the footer and look for return information",
      "Scroll to the middle of the page and look for customer service links",
      "Scroll to the top navigation and look for help or support links"
    ];
    
    for (const scrollPrompt of scrollPrompts) {
      try {
        console.log(`[${domain}] ${scrollPrompt}...`);
        await page.act(scrollPrompt);
        await page.waitForTimeout(2000);
        
        // Try to find and click on additional info links
        const additionalPrompts = [
          `Find and click on FAQ or help links on ${domain}`,
          `Find and click on terms and conditions links on ${domain}`,
          `Find and click on customer service or contact links on ${domain}`,
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
              
              await page.waitForTimeout(5000); // Longer wait
              await page.act("Scroll through the entire page to see all information");
              await page.waitForTimeout(2000);
              
              // Extract additional data
              const additionalData = await page.extract({
                instruction: `Extract any return-related information from this page for ${domain}`,
                schema: returnSchema
              });
              
              // Go back to homepage
              await page.goBack();
              await page.waitForTimeout(3000);
              await page.act("Scroll to the bottom of the page to see footer links");
              await page.waitForTimeout(2000);
              
              // Merge with homepage data
              returnPageData = additionalData;
              break;
            }
          } catch (err) {
            console.warn(`[${domain}] Additional info extraction failed:`, err);
          }
        }
        
        if (returnPageData) break;
      } catch (err) {
        console.warn(`[${domain}] Scroll attempt failed:`, err);
      }
    }
    
    // Step 4: Final extraction from homepage with full page view
    console.log(`[${domain}] Performing final extraction from homepage with full page view...`);
    
    // Scroll through entire page one more time
    await page.act("Scroll through the entire page from top to bottom to see all content");
    await page.waitForTimeout(3000);
    
    const homepageData = await page.extract({
      instruction: prompt,
      schema: returnSchema
    });
    
    // Merge data if we have both
    if (returnPageData) {
      // Merge the data using priority-based approach (terms > return > faq > homepage)
      const extractedDataArray = [
        { data: homepageData, page: 'homepage' }, 
        { data: returnPageData, page: 'return-page' }
      ];
      
      // Check if we have terms page data (from navigation strategy)
      if (navigationResult && navigationResult.success && navigationResult.data.length > 0) {
        // Add terms page data with highest priority
        console.log(`[${domain}] DEBUG: Adding ${navigationResult.data.length} pages from navigation strategy:`);
        navigationResult.data.forEach((item, index) => {
          console.log(`[${domain}] DEBUG: Page ${index + 1}: ${item.page} - has data: ${!!item.data}`);
        });
        extractedDataArray.push(...navigationResult.data);
      } else {
        console.log(`[${domain}] DEBUG: No navigation strategy data available`);
      }
      
      console.log(`[${domain}] DEBUG: Total data sources for merge: ${extractedDataArray.length}`);
      extractedDataArray.forEach((item, index) => {
        console.log(`[${domain}] DEBUG: Source ${index + 1}: ${item.page}`);
      });
      
      const mergedData = await mergeExtractedData(extractedDataArray, domain);
      console.log(`[${domain}] Return extraction completed with priority-based merged data from ${extractedDataArray.length} sources.`);
      return mergedData;
    } else {
      console.log(`[${domain}] Return extraction completed from homepage only.`);
      return homepageData;
    }
  } catch (err) {
    console.error(`[${domain}] Error processing:`, err);
    // Log error to file
    const normalizedDomain = domain.toLowerCase();
    const errorFile = path.join(RESULT_DIR, `error-${normalizedDomain}-${getTimestamp()}.log`);
    let stack = '';
    if (err instanceof Error) {
      stack = err.stack || '';
    }
    const errorMsg = `[${normalizedDomain}] Error: ${util.format(err)}\nStack: ${stack}`;
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
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[${domain}] 🚀 Attempt ${attempt}/${maxRetries} with robust session management`);
      
      const result = await processDomain(domain);
      if (result) {
        console.log(`[${domain}] ✅ Success on attempt ${attempt}`);
        return result;
      }
    } catch (err: any) {
      lastError = err;
      console.error(`[${domain}] ❌ Attempt ${attempt} failed:`, err.message);
      
      // Specific error handling
      if (err.message.includes('CDP connection') || 
          err.message.includes('browser context is undefined') ||
          err.message.includes('StagehandInitError')) {
        logErrorStats(domain, 'cdp');
        console.log(`[${domain}] 🔄 CDP error detected, will retry with exponential backoff`);
      } else if (err.message.includes('timeout') || err.message.includes('net::ERR_')) {
        logErrorStats(domain, 'network');
        console.log(`[${domain}] 🌐 Network error detected, will retry`);
      } else {
        logErrorStats(domain, 'other');
        console.log(`[${domain}] ⚠️ Other error type, will retry`);
      }
      
      // Exponential backoff: 5s, 10s, 15s
      if (attempt < maxRetries) {
        const waitTime = 5000 * attempt;
        console.log(`[${domain}] ⏳ Waiting ${waitTime/1000}s before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  // Log detailed failure information
  const normalizedDomain = domain.toLowerCase();
  const errorFile = path.join(RESULT_DIR, `failed-${normalizedDomain}-${getTimestamp()}.log`);
  const errorMessage = `[${normalizedDomain}] Failed after ${maxRetries} attempts\nLast error: ${lastError?.message || 'Unknown error'}\nStack: ${lastError?.stack || 'No stack trace'}`;
  await fs.writeFile(errorFile, errorMessage, 'utf-8');
  
  console.log(`[${domain}] 💀 All ${maxRetries} attempts failed. Last error: ${lastError?.message}`);
  return null;
}

async function aggregateResults() {
  const files = await fs.readdir(RESULT_DIR);
  const resultData: Record<string, any> = {};
  const allDomains = new Set<string>();
  
  // Collect all successful JSONs (with timestamp in filename)
  for (const file of files) {
    if (file.startsWith('return-info-') && file.endsWith('.json') && !file.startsWith('return-info-ALL-SITES')) {
      const filePath = path.join(RESULT_DIR, file);
      try {
        const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
        if (data && data.website) {
          const { website, ...rest } = data;
          // Normalize domain to lowercase for consistent handling
          const normalizedWebsite = website.toLowerCase();
          
          // Use the most recent result if multiple files exist for same domain
          if (!resultData[normalizedWebsite] || file.includes(getTimestamp().split('T')[0])) {
            resultData[normalizedWebsite] = rest;
            allDomains.add(normalizedWebsite);
          }
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
          // Normalize domain to lowercase for consistent handling
          const normalizedDomain = domain.toLowerCase();
          allDomains.add(normalizedDomain);
          if (!resultData[normalizedDomain]) {
            resultData[normalizedDomain] = { error: content };
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
      .map(line => line.replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
      .map(line => line.toLowerCase()); // Normalize to lowercase
  } catch (e) {
    console.warn('Failed to read websites.txt, using alphabetical order');
    orderedDomains = Array.from(allDomains).sort();
  }
  
  // Create ordered result maintaining websites.txt order
  const orderedResult: Record<string, any> = {};
  for (const domain of orderedDomains) {
    if (resultData[domain]) {
      orderedResult[domain] = resultData[domain];
    } else {
      // Add missing domains with error status to maintain order
      orderedResult[domain] = { 
        error: `No data found for ${domain}. Domain may not have been processed or failed.`,
        status: "missing"
      };
    }
  }
  
  // Add any remaining domains not in websites.txt (should be rare)
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
  
  // Print error statistics
  console.log(`\n📈 Error Recovery Statistics:`);
  console.log(`🔄 Total retries: ${errorStats.totalRetries}`);
  console.log(`🎉 Successful recoveries: ${errorStats.successfulRecoveries}`);
  console.log(`📊 CDP errors: ${errorStats.cdpErrors}`);
  console.log(`🌐 Network errors: ${errorStats.networkErrors}`);
  console.log(`⏰ Timeout errors: ${errorStats.timeoutErrors}`);
  console.log(`⚠️ Other errors: ${errorStats.otherErrors}`);
  
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
    
    // Normalize domain for processing (remove everything after /)
    const normalizedDomain = domain.replace(/\/.*$/, '').toLowerCase();
    console.log(`🔧 Normalized domain for processing: ${normalizedDomain}`);
    
    const result = await retryProcessDomain(normalizedDomain);
    
    if (result) {
      // Translate to English before saving
      const translatedResult = await translateToEnglish(result, domain);
      
      // Normalize domain to lowercase for consistent file naming with timestamp
      const timestamp = getTimestamp();
      const resultFile = path.join(RESULT_DIR, `return-info-${normalizedDomain}-${timestamp}.json`);
      await fs.writeFile(resultFile, JSON.stringify(translatedResult, null, 2), 'utf-8');
      console.log(`✅ Results written to: ${resultFile}`);
    } else {
      console.error(`❌ Failed to extract return information for: ${domain}`);
      process.exit(1);
    }
  }
}

// ES module main check
if (process.argv[1] && process.argv[1].endsWith('extract-returns-v2.ts')) {
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