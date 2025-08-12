#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Define expected structure
const expectedStructure = {
  'api': [
    'index.mdx',
    'endpoints/actions',
    'endpoints/flows', 
    'endpoints/execution-logs',
    'endpoints/tools',
    'endpoints/users',
    'endpoints/organizations',
    'endpoints/webhooks',
    'endpoints/health'
  ],
  'cli': [
    'index.mdx',
    'installation.mdx',
    'authentication.mdx',
    'configuration.mdx',
    'commands'
  ],
  'public/product': [
    'index.mdx',
    'getting-started',
    'actions',
    'flows',
    'tools',
    'organizations',
    'users',
    'webhooks',
    'execution-logs',
    'integrations',
    'use-cases'
  ],
  'sdk': [
    'typescript/index.mdx',
    'typescript/installation.mdx',
    'typescript/quickstart.mdx'
  ],
  'internal': [
    'architecture/overview.mdx',
    'development',
    'infrastructure',
    'operations',
    'decisions',
    'integrations'
  ]
};

function validateStructure() {
  console.log('🔍 Validating documentation structure...\n');
  
  let allValid = true;
  
  for (const [dir, expectedItems] of Object.entries(expectedStructure)) {
    console.log(`📁 Checking ${dir}/`);
    
    if (!fs.existsSync(dir)) {
      console.log(`❌ Directory ${dir} does not exist`);
      allValid = false;
      continue;
    }
    
    for (const item of expectedItems) {
      const fullPath = path.join(dir, item);
      if (!fs.existsSync(fullPath)) {
        console.log(`❌ Missing: ${fullPath}`);
        allValid = false;
      } else {
        console.log(`✅ Found: ${fullPath}`);
      }
    }
    console.log('');
  }
  
  return allValid;
}

function countFiles() {
  const patterns = {
    'Total MDX files': '**/*.mdx',
    'API endpoints': 'api/endpoints/**/*.mdx',
    'Product docs': 'public/product/**/*.mdx',
    'Internal docs': 'internal/**/*.mdx',
    'CLI docs': 'cli/**/*.mdx'
  };
  
  console.log('📊 Documentation Statistics:\n');
  
  for (const [label, pattern] of Object.entries(patterns)) {
    try {
      const count = require('glob').sync(pattern).length;
      console.log(`${label}: ${count} files`);
    } catch (e) {
      console.log(`${label}: Unable to count (glob not available)`);
    }
  }
}

function checkMermaidDiagrams() {
  console.log('\n🎨 Checking Mermaid diagram usage:\n');
  
  try {
    const glob = require('glob');
    const allMdxFiles = glob.sync('**/*.mdx');
    let mermaidFiles = 0;
    let totalFiles = allMdxFiles.length;
    
    allMdxFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('```mermaid')) {
        mermaidFiles++;
      }
    });
    
    console.log(`Files with Mermaid diagrams: ${mermaidFiles}`);
    console.log(`Total MDX files: ${totalFiles}`);
    console.log(`Coverage: ${Math.round((mermaidFiles / totalFiles) * 100)}%`);
    
  } catch (e) {
    console.log('Unable to analyze Mermaid usage (dependencies missing)');
  }
}

function main() {
  console.log('🚀 Tolstoy Documentation Validation\n');
  console.log('=====================================\n');
  
  const structureValid = validateStructure();
  
  if (structureValid) {
    console.log('✅ All required documentation structure is present!\n');
  } else {
    console.log('❌ Some required documentation is missing.\n');
  }
  
  countFiles();
  checkMermaidDiagrams();
  
  console.log('\n=====================================');
  console.log('✨ Validation complete!');
  
  if (structureValid) {
    console.log('🎉 Documentation structure is comprehensive and ready!');
    process.exit(0);
  } else {
    console.log('⚠️  Some improvements needed. See details above.');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { validateStructure, countFiles, checkMermaidDiagrams };