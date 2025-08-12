#!/usr/bin/env node

/**
 * Validate documentation structure, links, and content
 * Ensures all documentation follows best practices and is error-free
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const { glob } = require('glob');

class DocumentationValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.checkedFiles = 0;
    this.brokenLinks = [];
    this.duplicateIds = [];
    
    this.config = {
      docsDir: '.',
      requiredFrontmatter: ['title', 'description'],
      maxTitleLength: 60,
      maxDescriptionLength: 160,
      allowedFileTypes: ['.mdx', '.md', '.json', '.yaml', '.yml'],
      linkPatterns: [
        /\[([^\]]+)\]\(([^)]+)\)/g,  // Markdown links
        /href="([^"]+)"/g,           // HTML href attributes
        /<Card[^>]*href="([^"]+)"/g  // Mintlify Card components
      ]
    };
  }

  async run() {
    console.log('🔍 Starting documentation validation...');
    
    try {
      await this.validateStructure();
      await this.validateContent();
      await this.validateLinks();
      await this.validateNavigation();
      await this.generateReport();
      
      if (this.errors.length > 0) {
        process.exit(1);
      }
      
    } catch (error) {
      console.error('❌ Validation failed:', error.message);
      process.exit(1);
    }
  }

  async validateStructure() {
    console.log('📁 Validating directory structure...');
    
    const requiredDirs = [
      'public/product',
      'api/endpoints', 
      'cli',
      'sdk',
      'internal'
    ];
    
    for (const dir of requiredDirs) {
      try {
        const stat = await fs.stat(dir);
        if (!stat.isDirectory()) {
          this.addError(`Required directory missing: ${dir}`);
        }
      } catch (error) {
        this.addError(`Required directory missing: ${dir}`);
      }
    }
    
    // Validate docs.json exists and is valid
    await this.validateDocsConfig();
    
    console.log('   ✓ Directory structure validated');
  }

  async validateDocsConfig() {
    try {
      const docsJson = await fs.readFile('docs.json', 'utf8');
      const config = JSON.parse(docsJson);
      
      // Required fields
      const required = ['name', 'navigation'];
      for (const field of required) {
        if (!config[field]) {
          this.addError(`docs.json missing required field: ${field}`);
        }
      }
      
      // Validate navigation structure
      if (config.navigation && config.navigation.dropdowns) {
        for (const dropdown of config.navigation.dropdowns) {
          if (!dropdown.dropdown || !dropdown.icon) {
            this.addError(`Invalid dropdown in navigation: ${JSON.stringify(dropdown)}`);
          }
        }
      }
      
    } catch (error) {
      this.addError(`Invalid docs.json: ${error.message}`);
    }
  }

  async validateContent() {
    console.log('📄 Validating content files...');
    
    const mdxFiles = await glob('**/*.{md,mdx}', { 
      ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**']
    });
    
    for (const file of mdxFiles) {
      await this.validateFile(file);
    }
    
    console.log(`   ✓ Validated ${this.checkedFiles} content files`);
  }

  async validateFile(filePath) {
    this.checkedFiles++;
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const { frontmatter, body } = this.parseFrontmatter(content);
      
      // Validate frontmatter
      await this.validateFrontmatter(filePath, frontmatter);
      
      // Validate content
      await this.validateMarkdownContent(filePath, body);
      
      // Check for common issues
      await this.checkCommonIssues(filePath, content);
      
    } catch (error) {
      this.addError(`Error reading file ${filePath}: ${error.message}`);
    }
  }

  parseFrontmatter(content) {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    
    if (!frontmatterMatch) {
      return { frontmatter: {}, body: content };
    }
    
    try {
      const frontmatter = yaml.load(frontmatterMatch[1]);
      const body = frontmatterMatch[2];
      return { frontmatter, body };
    } catch (error) {
      throw new Error(`Invalid frontmatter YAML: ${error.message}`);
    }
  }

  async validateFrontmatter(filePath, frontmatter) {
    // Check required fields
    for (const field of this.config.requiredFrontmatter) {
      if (!frontmatter[field]) {
        this.addError(`${filePath}: Missing required frontmatter field: ${field}`);
      }
    }
    
    // Validate title length
    if (frontmatter.title && frontmatter.title.length > this.config.maxTitleLength) {
      this.addWarning(`${filePath}: Title too long (${frontmatter.title.length}/${this.config.maxTitleLength})`);
    }
    
    // Validate description length
    if (frontmatter.description && frontmatter.description.length > this.config.maxDescriptionLength) {
      this.addWarning(`${filePath}: Description too long (${frontmatter.description.length}/${this.config.maxDescriptionLength})`);
    }
    
    // Check for duplicate titles
    if (frontmatter.title) {
      const titleKey = frontmatter.title.toLowerCase();
      if (this.duplicateIds.includes(titleKey)) {
        this.addWarning(`${filePath}: Duplicate title detected: "${frontmatter.title}"`);
      } else {
        this.duplicateIds.push(titleKey);
      }
    }
  }

  async validateMarkdownContent(filePath, content) {
    // Check for broken Mintlify components
    const componentRegex = /<(\w+)[^>]*>/g;
    let match;
    
    const validComponents = [
      'ParamField', 'ResponseField', 'Card', 'CardGroup', 'Tabs', 'Tab',
      'CodeGroup', 'Steps', 'Step', 'Accordion', 'AccordionGroup',
      'Note', 'Warning', 'Info', 'Tip', 'Snippet', 'Frame', 'Expandable',
      'ResponseExample'
    ];
    
    while ((match = componentRegex.exec(content)) !== null) {
      const componentName = match[1];
      if (!validComponents.includes(componentName) && 
          !componentName.toLowerCase().match(/^[a-z]+$/)) {
        this.addWarning(`${filePath}: Unknown component: <${componentName}>`);
      }
    }
    
    // Check for unclosed components
    const openTags = content.match(/<(\w+)[^/>]*>/g) || [];
    const closeTags = content.match(/<\/(\w+)>/g) || [];
    
    if (openTags.length !== closeTags.length) {
      this.addWarning(`${filePath}: Possible unclosed components (${openTags.length} open, ${closeTags.length} close)`);
    }
  }

  async checkCommonIssues(filePath, content) {
    // Check for TODO comments
    if (content.includes('TODO') || content.includes('FIXME')) {
      this.addWarning(`${filePath}: Contains TODO/FIXME comments`);
    }
    
    // Check for placeholder content
    const placeholders = [
      'Lorem ipsum',
      'placeholder',
      'example.com',
      'your-api-key-here',
      'replace-with-actual'
    ];
    
    for (const placeholder of placeholders) {
      if (content.toLowerCase().includes(placeholder.toLowerCase())) {
        this.addWarning(`${filePath}: Contains placeholder content: "${placeholder}"`);
      }
    }
    
    // Check for long lines in code blocks
    const codeBlockRegex = /```[\s\S]*?```/g;
    let codeMatch;
    while ((codeMatch = codeBlockRegex.exec(content)) !== null) {
      const lines = codeMatch[0].split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].length > 120) {
          this.addWarning(`${filePath}: Long line in code block (line ${i + 1}): ${lines[i].length} chars`);
        }
      }
    }
  }

  async validateLinks() {
    console.log('🔗 Validating internal links...');
    
    const allFiles = await glob('**/*.{md,mdx}', {
      ignore: ['node_modules/**', '.git/**']
    });
    
    const validPaths = new Set();
    
    // Build set of valid paths
    for (const file of allFiles) {
      const pathWithoutExt = file.replace(/\.(md|mdx)$/, '');
      validPaths.add(`/${pathWithoutExt}`);
      validPaths.add(pathWithoutExt);
      
      // Handle index files
      if (pathWithoutExt.endsWith('/index')) {
        const dirPath = pathWithoutExt.replace('/index', '');
        validPaths.add(`/${dirPath}`);
        validPaths.add(dirPath);
      }
    }
    
    // Check links in each file
    for (const file of allFiles) {
      await this.checkLinksInFile(file, validPaths);
    }
    
    console.log(`   ✓ Validated links in ${allFiles.length} files`);
    
    if (this.brokenLinks.length > 0) {
      console.log(`   ⚠️ Found ${this.brokenLinks.length} broken links`);
    }
  }

  async checkLinksInFile(filePath, validPaths) {
    const content = await fs.readFile(filePath, 'utf8');
    
    for (const pattern of this.config.linkPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const link = match[match.length - 1]; // Last capture group is the URL
        
        // Skip external links and anchors
        if (link.startsWith('http') || link.startsWith('#') || link.includes('mailto:')) {
          continue;
        }
        
        // Check if internal link exists
        if (!validPaths.has(link)) {
          this.brokenLinks.push({
            file: filePath,
            link,
            text: match[1] || 'N/A'
          });
        }
      }
    }
  }

  async validateNavigation() {
    console.log('🧭 Validating navigation structure...');
    
    try {
      const docsJson = JSON.parse(await fs.readFile('docs.json', 'utf8'));
      const navigation = docsJson.navigation;
      
      if (navigation.dropdowns) {
        for (const dropdown of navigation.dropdowns) {
          if (dropdown.groups) {
            await this.validateNavigationGroup(dropdown.dropdown, dropdown.groups);
          }
        }
      }
      
      if (navigation.anchors) {
        await this.validateNavigationAnchors(navigation.anchors);
      }
      
    } catch (error) {
      this.addError(`Navigation validation failed: ${error.message}`);
    }
    
    console.log('   ✓ Navigation structure validated');
  }

  async validateNavigationGroup(dropdownName, groups) {
    for (const group of groups) {
      if (!group.group || !group.pages) {
        this.addError(`Invalid navigation group in ${dropdownName}: missing group name or pages`);
        continue;
      }
      
      for (const page of group.pages) {
        // Check if referenced file exists
        const mdxPath = `${page}.mdx`;
        const mdPath = `${page}.md`;
        
        try {
          await fs.access(mdxPath);
        } catch {
          try {
            await fs.access(mdPath);
          } catch {
            this.addError(`Navigation references non-existent page: ${page}`);
          }
        }
      }
    }
  }

  async validateNavigationAnchors(anchors) {
    for (const anchor of anchors) {
      if (!anchor.anchor || !anchor.icon) {
        this.addError(`Invalid navigation anchor: missing anchor name or icon`);
      }
      
      if (anchor.href && anchor.href.startsWith('/')) {
        // Internal link - validate it exists
        const page = anchor.href.replace(/^\//, '');
        const mdxPath = `${page}.mdx`;
        const mdPath = `${page}.md`;
        
        try {
          await fs.access(mdxPath);
        } catch {
          try {
            await fs.access(mdPath);
          } catch {
            this.addError(`Navigation anchor references non-existent page: ${anchor.href}`);
          }
        }
      }
    }
  }

  async generateReport() {
    console.log('\n📊 Validation Report');
    console.log('='.repeat(50));
    
    console.log(`Files checked: ${this.checkedFiles}`);
    console.log(`Errors: ${this.errors.length}`);
    console.log(`Warnings: ${this.warnings.length}`);
    console.log(`Broken links: ${this.brokenLinks.length}`);
    
    if (this.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.errors.forEach(error => console.log(`   • ${error}`));
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      this.warnings.forEach(warning => console.log(`   • ${warning}`));
    }
    
    if (this.brokenLinks.length > 0) {
      console.log('\n🔗 Broken Links:');
      this.brokenLinks.forEach(link => 
        console.log(`   • ${link.file}: "${link.text}" -> ${link.link}`)
      );
    }
    
    // Generate JSON report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        filesChecked: this.checkedFiles,
        errors: this.errors.length,
        warnings: this.warnings.length,
        brokenLinks: this.brokenLinks.length
      },
      errors: this.errors,
      warnings: this.warnings,
      brokenLinks: this.brokenLinks
    };
    
    await fs.writeFile('validation-report.json', JSON.stringify(report, null, 2));
    
    if (this.errors.length === 0 && this.warnings.length === 0 && this.brokenLinks.length === 0) {
      console.log('\n✅ All validation checks passed!');
    } else if (this.errors.length === 0) {
      console.log('\n✅ No critical errors found (warnings and broken links should be addressed)');
    } else {
      console.log('\n❌ Validation failed - please fix the errors above');
    }
  }

  addError(message) {
    this.errors.push(message);
  }

  addWarning(message) {
    this.warnings.push(message);
  }
}

// CLI commands
async function main() {
  const command = process.argv[2];
  const options = {
    verbose: process.argv.includes('--verbose'),
    fixable: process.argv.includes('--fix'),
    warningsAsErrors: process.argv.includes('--warnings-as-errors')
  };
  
  const validator = new DocumentationValidator();
  
  switch (command) {
    case 'validate':
    default:
      await validator.run();
      break;
    case 'check-links':
      await validator.validateLinks();
      break;
    case 'check-structure':
      await validator.validateStructure();
      break;
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { DocumentationValidator };