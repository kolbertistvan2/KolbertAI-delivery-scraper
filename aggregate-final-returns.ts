import * as fs from 'fs/promises';
import * as path from 'path';

// Function to detect incorrect country-specific data
function detectIncorrectCountryData(data: any, domain: string): boolean {
  if (!data || typeof data !== 'object') return false;
  
  // Check for UK-specific indicators in Serbian domains
  const isSerbianDomain = domain.includes('.rs');
  if (isSerbianDomain) {
    const ukIndicators = [
      'DPD', 'Parcelforce', 'Royal Mail', 'Evri', 'InPost',
      '£', 'pound', 'sterling', 'UK', 'United Kingdom'
    ];
    
    const dataString = JSON.stringify(data).toLowerCase();
    for (const indicator of ukIndicators) {
      if (dataString.includes(indicator.toLowerCase())) {
        console.log(`🚨 Detected UK data in Serbian domain ${domain}: ${indicator}`);
        return true;
      }
    }
  }
  
  return false;
}

// Function to calculate data quality score for a domain
function calculateDataQualityScore(data: any, domain: string = ''): number {
  if (!data || typeof data !== 'object') return 0;
  
  let score = 0;
  const fields = [
    'IN_STORE_RETURN', 'HOME_COLLECTION', 'DROP_OFF_PARCEL_SHOP', 
    'DROP_OFF_PARCEL_LOCKER', 'FREE_RETURN', 'QR_CODE_BARCODE_PIN', 
    'EXTERNAL_RETURN_PORTAL', 'SUMMARY'
  ];
  
  // Count non-empty fields
  for (const field of fields) {
    if (data[field] && typeof data[field] === 'object') {
      const fieldData = data[field];
      if (fieldData.available && fieldData.available !== 'not available') {
        score += 1;
      }
      // Check for other meaningful data in the field
      const fieldKeys = Object.keys(fieldData);
      for (const key of fieldKeys) {
        if (fieldData[key] && fieldData[key] !== 'not available' && 
            fieldData[key] !== null && fieldData[key] !== '') {
          score += 0.5;
        }
      }
    }
  }
  
  // Bonus for having SUMMARY
  if (data.SUMMARY && data.SUMMARY !== 'not available') {
    score += 2;
  }
  
  // Penalty for incorrect country data
  if (domain && detectIncorrectCountryData(data, domain)) {
    score -= 10; // Heavy penalty for incorrect country data
  }
  
  return score;
}

// Function to normalize domain name
function normalizeDomain(domain: string): string {
  return domain.toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .trim();
}

// Function to filter and deduplicate domains
function filterAndDeduplicateDomains(resultData: Record<string, any>, websitesList: string[]): Record<string, any> {
  const normalizedWebsites = websitesList.map(d => normalizeDomain(d));
  const filteredData: Record<string, any> = {};
  const domainGroups: Record<string, string[]> = {};
  
  console.log(`🔍 Grouping ${Object.keys(resultData).length} domains by normalized names...`);
  
  // Group domains by normalized name
  for (const [domain, data] of Object.entries(resultData)) {
    const normalized = normalizeDomain(domain);
    if (!domainGroups[normalized]) {
      domainGroups[normalized] = [];
    }
    domainGroups[normalized].push(domain);
  }
  
  console.log(`📊 Found ${Object.keys(domainGroups).length} unique normalized domains`);
  
  // Process each group
  for (const [normalizedDomain, domains] of Object.entries(domainGroups)) {
    if (domains.length === 1) {
      // Single domain, keep it if it's in websites.txt or has good data
      const domain = domains[0];
      if (normalizedWebsites.includes(normalizedDomain) || calculateDataQualityScore(resultData[domain], domain) > 0) {
        filteredData[domain] = resultData[domain];
      }
    } else {
      // Multiple domains, choose the best one
      console.log(`🔄 Processing group for ${normalizedDomain}: ${domains.join(', ')}`);
      
      let bestDomain = domains[0];
      let bestScore = calculateDataQualityScore(resultData[bestDomain], bestDomain);
      let bestInWebsites = normalizedWebsites.includes(normalizedDomain);
      
      for (const domain of domains) {
        const score = calculateDataQualityScore(resultData[domain], domain);
        const inWebsites = normalizedWebsites.includes(normalizedDomain);
        
        console.log(`  - ${domain}: score=${score}, inWebsites=${inWebsites}`);
        
        // Priority: websites.txt > data quality > format
        if (inWebsites && !bestInWebsites) {
          bestDomain = domain;
          bestScore = score;
          bestInWebsites = true;
        } else if (inWebsites === bestInWebsites) {
          if (score > bestScore) {
            bestDomain = domain;
            bestScore = score;
          } else if (score === bestScore) {
            // If scores are equal, prefer the one without www. prefix
            const currentHasWww = domain.includes('www.');
            const bestHasWww = bestDomain.includes('www.');
            if (!currentHasWww && bestHasWww) {
              bestDomain = domain;
            }
          }
        }
      }
      
      console.log(`  ✅ Selected: ${bestDomain} (score: ${bestScore}, inWebsites: ${bestInWebsites})`);
      
      // Only keep if it's in websites.txt or has meaningful data
      if (bestInWebsites || bestScore > 0) {
        filteredData[bestDomain] = resultData[bestDomain];
      }
    }
  }
  
  return filteredData;
}

// Function to get timestamp
function getTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

// Function to clean JSON structure to match prompt format exactly
function cleanJsonStructure(data: any): any {
  if (!data || typeof data !== 'object') return data;
  
  // Define the exact structure from the prompt
  const allowedFields = [
    'country',
    'IN_STORE_RETURN',
    'HOME_COLLECTION', 
    'DROP_OFF_PARCEL_SHOP',
    'DROP_OFF_PARCEL_LOCKER',
    'FREE_RETURN',
    'QR_CODE_BARCODE_PIN',
    'EXTERNAL_RETURN_PORTAL',
    'SUMMARY'
  ];
  
  const cleanedData: any = {};
  
  // Only keep fields that are in the prompt structure
  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      cleanedData[field] = data[field];
    }
  }
  
  return cleanedData;
}

async function aggregateFinalReturns() {
  const SOURCE_DIR = 'result-returns-v2';
  const FINAL_DIR = 'final-result-returns-v2';
  
  // Create final directory if it doesn't exist
  try {
    await fs.mkdir(FINAL_DIR, { recursive: true });
  } catch (e) {
    // Directory might already exist
  }
  
  console.log(`🚀 Starting final returns aggregation from ${SOURCE_DIR} to ${FINAL_DIR}...`);
  
  const files = await fs.readdir(SOURCE_DIR);
  const resultData: Record<string, any> = {};
  const allDomains = new Set<string>();
  
  // Collect all successful JSONs (with timestamp in filename)
  console.log(`📁 Reading return JSON files from ${SOURCE_DIR}...`);
  for (const file of files) {
    if (file.startsWith('return-info-') && file.endsWith('.json') && !file.startsWith('return-info-ALL-SITES')) {
      const filePath = path.join(SOURCE_DIR, file);
      try {
        const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
        if (data && data.website) {
          const { website, ...rest } = data;
          // Normalize domain to lowercase and remove www. prefix for consistent handling
          let normalizedWebsite = website.toLowerCase();
          normalizedWebsite = normalizedWebsite.replace(/^www\./, '');
          
          // Use the most recent result if multiple files exist for same domain
          if (!resultData[normalizedWebsite]) {
            // Clean the data to match prompt format exactly
            const cleanedData = cleanJsonStructure(rest);
            resultData[normalizedWebsite] = cleanedData;
            allDomains.add(normalizedWebsite);
          } else {
            // If we already have data for this domain, keep the existing one (it's already the most recent)
            console.log(`[AGGREGATE] Skipping ${file} - already have data for ${normalizedWebsite}`);
          }
        }
      } catch (e) {
        console.warn(`Failed to parse ${file}:`, e);
      }
    }
  }
  
  console.log(`📊 Found ${Object.keys(resultData).length} unique domains in return JSON files`);
  
  // Add failed logs for missing domains (only domains that failed after 3 attempts)
  console.log(`📁 Reading failed return log files...`);
  for (const file of files) {
    if (file.startsWith('failed-') && file.endsWith('.log')) {
      const filePath = path.join(SOURCE_DIR, file);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        
        // Extract domain from filename (failed- prefix)
        let domain = file.replace('failed-', '').replace(/-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.log$/, '');
        
        // Fallback: try to extract from content if filename method fails
        if (!domain) {
          const domainMatch = content.match(/\[([^\]]+)\]/);
          if (domainMatch) {
            domain = domainMatch[1];
          }
        }
        
        if (domain) {
          // Normalize domain to lowercase for consistent handling
          const normalizedDomain = domain.toLowerCase();
          allDomains.add(normalizedDomain);
          if (!resultData[normalizedDomain]) {
            resultData[normalizedDomain] = { 
              error: content,
              status: "failed"
            };
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
    
    console.log(`📋 Read ${orderedDomains.length} domains from websites.txt`);
  } catch (e) {
    console.warn('Failed to read websites.txt, using alphabetical order');
    orderedDomains = Array.from(allDomains).sort();
  }
  
  // Filter and deduplicate domains based on quality
  console.log(`🔍 Filtering and deduplicating ${Object.keys(resultData).length} return domains...`);
  const filteredResultData = filterAndDeduplicateDomains(resultData, orderedDomains);
  console.log(`✅ Filtered to ${Object.keys(filteredResultData).length} unique return domains`);
  
  // Create ordered result maintaining websites.txt order
  const orderedResult: Record<string, any> = {};
  
  // First, add domains in the exact order from websites.txt
  for (const domain of orderedDomains) {
    if (filteredResultData[domain]) {
      orderedResult[domain] = filteredResultData[domain];
    } else {
      // Add missing domains with error status to maintain order
      orderedResult[domain] = { 
        error: `No return data found for ${domain}. Domain may not have been processed or failed.`,
        status: "missing"
      };
    }
  }
  
  // Then, add any remaining filtered domains not in websites.txt (should be rare)
  for (const domain of Object.keys(filteredResultData)) {
    if (!orderedResult[domain]) {
      orderedResult[domain] = filteredResultData[domain];
    }
  }
  
  // Write aggregated results
  const timestamp = getTimestamp();
  const allSitesFile = path.join(FINAL_DIR, `return-info-ALL-SITES-${timestamp}.json`);
  await fs.writeFile(allSitesFile, JSON.stringify(orderedResult, null, 2), 'utf-8');
  
  console.log(`✅ Final aggregated return results written to: ${allSitesFile}`);
  console.log(`📊 Total return domains processed: ${Object.keys(orderedResult).length}`);
  console.log(`✅ Successful return extractions: ${Object.keys(orderedResult).filter(d => !orderedResult[d].error).length}`);
  console.log(`❌ Failed return extractions: ${Object.keys(orderedResult).filter(d => orderedResult[d].error).length}`);
  
  return orderedResult;
}

async function main() {
  try {
    await aggregateFinalReturns();
  } catch (error) {
    console.error('❌ Error during return aggregation:', error);
    process.exit(1);
  }
}

// Run the script
main(); 