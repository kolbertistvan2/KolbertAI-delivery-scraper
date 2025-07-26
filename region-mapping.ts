// Region mapping for Browserbase to optimize performance based on target country
export interface RegionMapping {
  country: string;
  region: string;
  description: string;
  latency: 'low' | 'medium' | 'high';
}

export const REGION_MAPPINGS: RegionMapping[] = [
  // Eastern Europe - Optimal regions
  { country: 'hungary', region: 'eu-central-1', description: 'Frankfurt - Closest to Hungary', latency: 'low' },
  { country: 'poland', region: 'eu-central-1', description: 'Frankfurt - Closest to Poland', latency: 'low' },
  { country: 'czechia', region: 'eu-central-1', description: 'Frankfurt - Closest to Czech Republic', latency: 'low' },
  { country: 'slovakia', region: 'eu-central-1', description: 'Frankfurt - Closest to Slovakia', latency: 'low' },
  { country: 'slovenia', region: 'eu-central-1', description: 'Frankfurt - Closest to Slovenia', latency: 'low' },
  { country: 'croatia', region: 'eu-central-1', description: 'Frankfurt - Closest to Croatia', latency: 'low' },
  { country: 'serbia', region: 'eu-central-1', description: 'Frankfurt - Closest to Serbia', latency: 'low' },
  { country: 'romania', region: 'eu-central-1', description: 'Frankfurt - Closest to Romania', latency: 'low' },
  
  // Western Europe
  { country: 'germany', region: 'eu-central-1', description: 'Frankfurt - Germany', latency: 'low' },
  { country: 'france', region: 'eu-west-1', description: 'Ireland - Closest to France', latency: 'low' },
  { country: 'italy', region: 'eu-central-1', description: 'Frankfurt - Closest to Italy', latency: 'low' },
  { country: 'spain', region: 'eu-west-1', description: 'Ireland - Closest to Spain', latency: 'low' },
  { country: 'uk', region: 'eu-west-1', description: 'Ireland - Closest to UK', latency: 'low' },
  
  // Fallback regions
  { country: 'default', region: 'eu-central-1', description: 'Frankfurt - Default for Europe', latency: 'medium' },
];

export function getOptimalRegion(country: string): string {
  const normalizedCountry = country.toLowerCase().trim();
  
  // Find exact match
  const exactMatch = REGION_MAPPINGS.find(mapping => 
    mapping.country === normalizedCountry
  );
  
  if (exactMatch) {
    console.log(`🌍 Using optimal region for ${country}: ${exactMatch.region} (${exactMatch.description})`);
    return exactMatch.region;
  }
  
  // Find partial match
  const partialMatch = REGION_MAPPINGS.find(mapping => 
    normalizedCountry.includes(mapping.country) || mapping.country.includes(normalizedCountry)
  );
  
  if (partialMatch) {
    console.log(`🌍 Using partial match region for ${country}: ${partialMatch.region} (${partialMatch.description})`);
    return partialMatch.region;
  }
  
  // Use default
  const defaultRegion = REGION_MAPPINGS.find(mapping => mapping.country === 'default');
  console.log(`🌍 Using default region for ${country}: ${defaultRegion?.region} (${defaultRegion?.description})`);
  return defaultRegion?.region || 'eu-central-1';
}

export function getRegionInfo(country: string): RegionMapping {
  const region = getOptimalRegion(country);
  return REGION_MAPPINGS.find(mapping => mapping.region === region) || 
         REGION_MAPPINGS.find(mapping => mapping.country === 'default')!;
}

// Helper function to extract country from domain or prompt
export function extractCountryFromDomain(domain: string): string {
  const domainLower = domain.toLowerCase();
  
  // Country-specific domain patterns
  const countryPatterns = [
    { pattern: /\.hu$/, country: 'hungary' },
    { pattern: /\.pl$/, country: 'poland' },
    { pattern: /\.cz$/, country: 'czechia' },
    { pattern: /\.sk$/, country: 'slovakia' },
    { pattern: /\.si$/, country: 'slovenia' },
    { pattern: /\.hr$/, country: 'croatia' },
    { pattern: /\.rs$/, country: 'serbia' },
    { pattern: /\.ro$/, country: 'romania' },
    { pattern: /\.de$/, country: 'germany' },
    { pattern: /\.fr$/, country: 'france' },
    { pattern: /\.it$/, country: 'italy' },
    { pattern: /\.es$/, country: 'spain' },
    { pattern: /\.uk$/, country: 'uk' },
    { pattern: /\.co\.uk$/, country: 'uk' },
  ];
  
  for (const { pattern, country } of countryPatterns) {
    if (pattern.test(domainLower)) {
      return country;
    }
  }
  
  // If no TLD match, try to infer from domain name
  if (domainLower.includes('hungary') || domainLower.includes('magyar')) return 'hungary';
  if (domainLower.includes('poland') || domainLower.includes('polska')) return 'poland';
  if (domainLower.includes('czech') || domainLower.includes('ceska')) return 'czechia';
  if (domainLower.includes('slovak')) return 'slovakia';
  if (domainLower.includes('sloven')) return 'slovenia';
  if (domainLower.includes('croat')) return 'croatia';
  if (domainLower.includes('serb')) return 'serbia';
  if (domainLower.includes('roman')) return 'romania';
  if (domainLower.includes('german') || domainLower.includes('deutsch')) return 'germany';
  if (domainLower.includes('french') || domainLower.includes('francais')) return 'france';
  if (domainLower.includes('italian') || domainLower.includes('italia')) return 'italy';
  if (domainLower.includes('spanish') || domainLower.includes('espana')) return 'spain';
  if (domainLower.includes('british') || domainLower.includes('england')) return 'uk';
  
  // Default to Hungary for Eastern European focus
  return 'hungary';
} 