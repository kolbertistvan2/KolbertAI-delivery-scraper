import { z } from 'zod';

// Navigation strategy interface
export interface NavigationStrategy {
  domain: string;
  selectors: {
    returnLink?: string;
    faqLinks?: string[];
    termsLink?: string;
    customerServiceLink?: string;
    cookieButtons?: string[];
  };
  fallbackPrompts?: string[];
}



// Common navigation strategies for known domains
export const NAVIGATION_STRATEGIES: NavigationStrategy[] = [
  {
    domain: 'zalando.cz',
    selectors: {
      returnLink: "xpath=/html[1]/body[1]/div[2]/div[2]/x-wrapper-footer[1]/div[1]/footer[1]/div[1]/div[1]/div[1]/div[1]/div[1]/section[1]/div[1]/ul[1]/li[3]/a[1]",
      faqLinks: [
        "xpath=/html[1]/body[1]/div[2]/div[2]/x-wrapper-samantha[1]/div[1]/main[1]/div[1]/div[1]/div[1]/main[1]/div[1]/div[1]/section[1]/div[1]/div[1]/div[1]/ul[1]/li[1]/p[1]/a[1]",
        "xpath=/html[1]/body[1]/div[2]/div[2]/x-wrapper-samantha[1]/div[1]/main[1]/div[1]/div[1]/div[1]/main[1]/div[1]/div[1]/section[1]/div[1]/div[1]/div[1]/ul[1]/li[2]/p[1]/a[1]",
        "xpath=/html[1]/body[1]/div[2]/div[2]/x-wrapper-samantha[1]/div[1]/main[1]/div[1]/div[1]/div[1]/main[1]/div[1]/div[1]/section[1]/div[1]/div[1]/div[1]/ul[1]/li[3]/p[1]/a[1]"
      ],
      termsLink: "xpath=/html[1]/body[1]/div[2]/div[2]/x-wrapper-footer[1]/div[1]/footer[1]/div[2]/div[2]/div[1]/div[1]/div[1]/div[1]/div[1]/ul[1]/li[2]/a[1]",
      cookieButtons: [
        "V pořádku",
        "Jen ty nezbytné",
        "Akceptovat"
      ]
    },
    fallbackPrompts: [
      "Find return policy or refund information",
      "Look for customer service or help links",
      "Search for terms and conditions"
    ]
  },
  {
    domain: 'notino.cz',
    selectors: {
      returnLink: "xpath=/html[1]/body[1]/div[2]/footer[1]/div[1]/div[1]/div[1]/section[3]/div[1]/ul[1]/li[5]/a[1]",
      faqLinks: [
        "xpath=/html[1]/body[1]/div[2]/footer[1]/div[1]/div[1]/div[1]/section[4]/div[1]/div[1]/ul[1]/li[3]/a[1]"
      ],
      termsLink: "xpath=/html[1]/body[1]/div[2]/footer[1]/div[1]/div[1]/div[1]/section[3]/div[1]/ul[1]/li[1]/a[1]",
      cookieButtons: [
        "Accept all cookies",
        "Accept",
        "OK"
      ]
    }
  },
  {
    domain: 'rohlik.cz',
    selectors: {
      returnLink: "xpath=/html[1]/body[1]/div[1]/div[2]/div[4]/footer[1]/div[1]/ul[1]/li[4]/div[1]/div[1]/a[1]",
      cookieButtons: [
        "Accept cookies",
        "OK",
        "I agree"
      ]
    }
  }
];

// LLM-based XPath generation function
export async function generateXPathForDomain(page: any, domain: string, action: string): Promise<string | null> {
  try {
    console.log(`[${domain}] Generating XPath for: ${action}`);
    
    const prompt = `Generate an XPath selector for the following action on ${domain}: ${action}
    
    Requirements:
    - Return only the XPath selector, no explanation
    - Use specific, reliable selectors
    - Focus on text content, IDs, or unique attributes
    - For return links, look for text like "return", "refund", "vrácení", "reklamace"
    - For FAQ links, look for "FAQ", "help", "support", "pomoc"
    - For terms links, look for "terms", "conditions", "podmínky"
    
    Example format: xpath=//a[contains(text(),'Return')] or xpath=//footer//a[contains(@href,'return')]`;
    
    const result = await page.extract({
      instruction: prompt,
      schema: z.object({
        xpath: z.string().describe("The XPath selector for the requested action")
      })
    });
    
    if (result && result.xpath) {
      console.log(`[${domain}] Generated XPath: ${result.xpath}`);
      return result.xpath;
    }
    
    return null;
  } catch (error) {
    console.warn(`[${domain}] XPath generation failed:`, error);
    return null;
  }
}

// Direct navigation function using pre-defined or generated selectors
export async function directNavigate(page: any, domain: string, action: string): Promise<boolean> {
  try {
    console.log(`[${domain}] Attempting direct navigation for: ${action}`);
    
    // First, try pre-defined selectors
    const strategy = NAVIGATION_STRATEGIES.find(s => s.domain === domain);
    let selector: string | null = null;
    
    if (strategy) {
      switch (action) {
        case 'return':
          selector = strategy.selectors.returnLink || null;
          break;
        case 'faq':
          selector = strategy.selectors.faqLinks?.[0] || null;
          break;
        case 'terms':
          selector = strategy.selectors.termsLink || null;
          break;
        case 'customer-service':
          selector = strategy.selectors.customerServiceLink || null;
          break;
      }
    }
    
    // If no pre-defined selector, generate one with LLM
    if (!selector) {
      selector = await generateXPathForDomain(page, domain, action);
    }
    
    // Try to click the selector
    if (selector) {
      console.log(`[${domain}] Clicking selector: ${selector}`);
      await page.act({
        description: `Click ${action} link for ${domain}`,
        method: 'click',
        arguments: [],
        selector: selector
      });
      
      await page.waitForTimeout(3000);
      console.log(`[${domain}] Direct navigation successful for: ${action}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.warn(`[${domain}] Direct navigation failed for ${action}:`, error);
    return false;
  }
}

// Multi-step navigation strategy with data extraction
export async function executeNavigationStrategy(page: any, domain: string, returnSchema: any): Promise<{ success: boolean, data: any[] }> {
  try {
    console.log(`[${domain}] Executing multi-step navigation strategy with data extraction...`);
    
    const navigationSteps = [
      { action: 'return', description: 'Navigate to return page' },
      { action: 'faq', description: 'Navigate to FAQ section' },
      { action: 'terms', description: 'Navigate to terms and conditions' }
    ];
    
    let successCount = 0;
    const extractedData: any[] = [];
    
    for (const step of navigationSteps) {
      try {
        const success = await directNavigate(page, domain, step.action);
        if (success) {
          successCount++;
          console.log(`[${domain}] ${step.description} successful`);
          
          // Extract data from this page immediately
          console.log(`[${domain}] Extracting data from ${step.action} page...`);
          await page.act("Scroll through the entire page to see all content");
          await page.waitForTimeout(2000);
          
          try {
            const pageData = await page.extract({
              instruction: `Extract return information from the current ${step.action} page for ${domain}. Focus on return periods, methods, costs, conditions, and procedures.`,
              schema: returnSchema
            });
            
            if (pageData) {
              console.log(`[${domain}] Successfully extracted data from ${step.action} page`);
              extractedData.push({
                page: step.action,
                data: pageData
              });
            }
          } catch (extractError) {
            console.warn(`[${domain}] Data extraction failed for ${step.action} page:`, extractError);
          }
          
          // Go back to homepage for next step
          if (successCount < navigationSteps.length) {
            await page.goBack();
            await page.waitForTimeout(2000);
          }
        }
      } catch (error) {
        console.warn(`[${domain}] Navigation step failed: ${step.action}`, error);
      }
    }
    
    console.log(`[${domain}] Navigation strategy completed. Success: ${successCount}/${navigationSteps.length}, Data extracted from ${extractedData.length} pages`);
    return { success: successCount > 0, data: extractedData };
    
  } catch (error) {
    console.error(`[${domain}] Navigation strategy failed:`, error);
    return { success: false, data: [] };
  }
} 