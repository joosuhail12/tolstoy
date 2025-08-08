#!/usr/bin/env node

/**
 * Example: Basic CLI Usage
 * 
 * This example shows how to use the Tolstoy CLI programmatically
 * and demonstrates the template management workflow.
 */

const { TemplateManager, TolstoyClient } = require('../dist/index');
const path = require('path');

async function demonstrateTemplateWorkflow() {
  console.log('🚀 Tolstoy CLI Demo\n');

  // 1. Initialize template manager
  const templatesDir = path.join(__dirname, '../templates');
  const templateManager = new TemplateManager(templatesDir);

  console.log('📋 Step 1: List available templates');
  const templates = templateManager.listTemplates();
  console.log(`Found ${templates.length} templates:`);
  templates.forEach((template, index) => {
    console.log(`  ${index + 1}. ${template.name} - ${template.description}`);
  });
  console.log();

  // 2. Show categories and tags
  console.log('📁 Step 2: Browse by categories and tags');
  const categories = templateManager.getCategories();
  const tags = templateManager.getTags();
  
  console.log(`Categories: ${categories.join(', ')}`);
  console.log(`Tags: ${tags.slice(0, 10).join(', ')}${tags.length > 10 ? '...' : ''}`);
  console.log();

  // 3. Load and validate a specific template
  console.log('🔍 Step 3: Load and validate a template');
  const helloWorldTemplate = templateManager.loadTemplate('Hello World');
  console.log(`Template: ${helloWorldTemplate.name}`);
  console.log(`Steps: ${helloWorldTemplate.steps.length}`);
  console.log(`Version: ${helloWorldTemplate.version}`);

  const validation = templateManager.validateTemplate(helloWorldTemplate);
  console.log(`Valid: ${validation.valid ? '✅' : '❌'}`);
  if (!validation.valid) {
    console.log('Errors:', validation.errors);
  }
  console.log();

  // 4. Demonstrate filtering
  console.log('🔎 Step 4: Filter templates');
  const gettingStartedTemplates = templateManager.getTemplatesByCategory('Getting Started');
  console.log(`Getting Started templates: ${gettingStartedTemplates.map(t => t.name).join(', ')}`);

  const simpleTemplates = templateManager.searchTemplatesByTags(['simple']);
  console.log(`Simple templates: ${simpleTemplates.map(t => t.name).join(', ')}`);
  console.log();

  // 5. Show what would be sent to API
  console.log('📤 Step 5: Prepare for API import');
  const flowData = {
    name: helloWorldTemplate.name,
    description: helloWorldTemplate.description,
    steps: helloWorldTemplate.steps,
    trigger: helloWorldTemplate.trigger,
    schedule: helloWorldTemplate.schedule,
    inputs: helloWorldTemplate.inputs || [],
    metadata: {
      source: 'template',
      templateVersion: helloWorldTemplate.version,
      importedAt: new Date().toISOString()
    }
  };

  console.log('Flow data ready for API:');
  console.log(`  Name: ${flowData.name}`);
  console.log(`  Steps: ${flowData.steps.length}`);
  console.log(`  Source: ${flowData.metadata.source}`);
  console.log(`  Version: ${flowData.metadata.templateVersion}`);
  console.log();

  console.log('✅ Demo completed successfully!');
  console.log('\nNext steps:');
  console.log('1. Set up your API credentials: export TOLSTOY_API_KEY="your-key"');
  console.log('2. Test connection: tolstoy auth');
  console.log('3. Import a template: tolstoy templates import "Hello World" --org your-org-id');
}

// Handle API client example (would require credentials)
async function demonstrateApiClient() {
  console.log('\n🔌 API Client Demo (requires credentials)');
  
  try {
    // This would fail without proper credentials, which is expected
    const client = new TolstoyClient({
      apiUrl: process.env.TOLSTOY_API_URL || 'http://localhost:3000',
      apiKey: process.env.TOLSTOY_API_KEY || 'demo-key'
    });

    console.log('✅ TolstoyClient initialized');
    console.log('Note: Actual API calls require valid credentials');
  } catch (error) {
    console.log('Note: API client requires valid credentials');
    console.log('Set TOLSTOY_API_KEY environment variable to test API integration');
  }
}

// Run the demo
if (require.main === module) {
  demonstrateTemplateWorkflow()
    .then(() => demonstrateApiClient())
    .catch(error => {
      console.error('Demo failed:', error.message);
      process.exit(1);
    });
}