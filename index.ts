// Generated script for workflow 2af9a48f-36c9-44d4-9904-b13486aa9646
// Generated at 2025-07-08T10:41:14.490Z



import { Stagehand } from "@browserbasehq/stagehand";
import { z } from 'zod';
import StagehandConfig from "./stagehand.config.js";

// Stagehand configuration

async function runWorkflow() {
  let stagehand: Stagehand | null = null;
  
  try {
    // Initialize Stagehand
    console.log("Initializing Stagehand...");
    stagehand = new Stagehand(StagehandConfig);
    await stagehand.init();
    console.log("Stagehand initialized successfully.");
    
    // Get the page instance
    const page = stagehand.page;
    if (!page) {
      throw new Error("Failed to get page instance from Stagehand");
    }
    
    
    
// Step 1: Navigate to URL
console.log("Navigating to: https://ekupi.hr/");
await page.goto("https://ekupi.hr/");
    
// Step 2: Perform action
console.log("Performing action: click the Prihvaćam sve button");
await page.act({
  description: "click the Prihvaćam sve button",
  method: "click",
  arguments: [],
  selector: "xpath=/html[1]/body[1]/div[1]/div[1]/div[4]/div[1]/div[1]/div[2]/button[4]"
});
    
    
    console.log("Workflow completed successfully");
    return { success: true };
  } catch (error) {
    console.error("Workflow failed:", error);
    return { success: false, error };
  } finally {
    // Clean up
    if (stagehand) {
      console.log("Closing Stagehand connection.");
      try {
        await stagehand.close();
      } catch (err) {
        console.error("Error closing Stagehand:", err);
      }
    }
  }
}


// Single execution
runWorkflow().then((result) => {
  console.log('Execution result:', result);
  process.exit(result.success ? 0 : 1);
});


runWorkflow();