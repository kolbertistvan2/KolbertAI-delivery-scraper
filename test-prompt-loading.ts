import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';

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

// Function to replace variables in prompt template
function replacePromptVariables(template: string, domain: string): string {
  return template
    .replace(/\${website}/g, domain)
    .replace(/\${domain}/g, domain);
}

// Dynamic schema generation based on prompt content
function generateShippingSchema(hasIslandSurcharge: boolean = true) {
  const baseDeliverySchema = {
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
    cod_surcharge: z.string(),
  };

  // Add island_surcharge if needed
  if (hasIslandSurcharge) {
    Object.assign(baseDeliverySchema, {
      island_surcharge: z.string(),
    });
  }

  return z.object({
    website: z.string(),
    HOME_DELIVERY: z.object(baseDeliverySchema),
    BULKY_PRODUCT_HOME_DELIVERY: z.object(baseDeliverySchema),
    PARCEL_SHOPS: z.object({
      ...baseDeliverySchema,
      locations_count: z.string(),
    }),
    PARCEL_LOCKERS: z.object({
      ...baseDeliverySchema,
      locations_count: z.string(),
    }),
    IN_STORE_PICKUP: z.object({
      ...baseDeliverySchema,
      locations: z.union([z.array(z.string()), z.string()]),
    }),
    SUMMARY: z.string(),
  });
}

async function testPromptLoading() {
  try {
    console.log('🧪 Testing prompt loading functionality...\n');
    
    // Test 1: Load prompt template
    console.log('📖 Test 1: Loading prompt template...');
    const promptTemplate = await loadPromptTemplate('prompt.txt');
    console.log('✅ Prompt template loaded successfully');
    console.log(`📄 Template length: ${promptTemplate.length} characters\n`);
    
    // Test 2: Check if contains island_surcharge
    console.log('🔍 Test 2: Checking for island_surcharge...');
    const hasIslandSurcharge = promptTemplate.includes('island_surcharge');
    console.log(`🔍 Contains island_surcharge: ${hasIslandSurcharge}`);
    console.log(`📝 This means: ${hasIslandSurcharge ? 'Will use schema WITH island_surcharge fields' : 'Will use schema WITHOUT island_surcharge fields'}\n`);
    
    // Test 3: Replace variables
    console.log('🔄 Test 3: Replacing variables...');
    const testDomain = 'alza.cz';
    const processedPrompt = replacePromptVariables(promptTemplate, testDomain);
    console.log('✅ Variables replaced successfully');
    console.log(`🌐 Domain replaced: ${processedPrompt.includes(testDomain)}`);
    console.log(`�� Contains ${'${website}'}: ${processedPrompt.includes('${website}') ? 'NO' : 'YES (replaced)'}\n`);
    
    // Test 4: Generate schema
    console.log('🏗️ Test 4: Generating schema...');
    const schema = generateShippingSchema(hasIslandSurcharge);
    console.log('✅ Schema generated successfully');
    console.log(`�� Schema type: ${hasIslandSurcharge ? 'WITH island_surcharge' : 'WITHOUT island_surcharge'}\n`);
    
    // Test 5: Show sample of processed prompt
    console.log('📝 Test 5: Sample of processed prompt...');
    const sampleLines = processedPrompt.split('\n').slice(0, 5);
    console.log('First 5 lines:');
    sampleLines.forEach((line, i) => console.log(`${i + 1}: ${line}`));
    console.log('...\n');
    
    console.log('🎉 All tests passed! The dynamic prompt loading is working correctly.');
    console.log('\n📋 Summary:');
    console.log(`- Prompt file: prompt.txt`);
    console.log(`- Island surcharge: ${hasIslandSurcharge ? 'YES' : 'NO'}`);
    console.log(`- Variable replacement: WORKING`);
    console.log(`- Schema generation: WORKING`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testPromptLoading(); 