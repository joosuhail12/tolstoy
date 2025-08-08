#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { templateManager, TemplateMetadata } from './templates';
import { TolstoyClient } from './client';

const program = new Command();

program
  .name('tolstoy')
  .description('Official CLI for Tolstoy workflow automation platform')
  .version('1.0.0');

// Global options
program
  .option('--api-url <url>', 'Tolstoy API base URL')
  .option('--api-key <key>', 'Tolstoy API key')
  .option('--json', 'Output in JSON format');

/**
 * Templates commands
 */
const templatesCmd = program
  .command('templates')
  .description('Manage flow templates');

// templates:list command
templatesCmd
  .command('list')
  .description('List available flow templates')
  .option('-c, --category <category>', 'Filter by category')
  .option('-t, --tag <tag>', 'Filter by tag')
  .option('--verbose', 'Show detailed template information')
  .action(async (options) => {
    try {
      let templates = templateManager.listTemplates();

      // Apply filters
      if (options.category) {
        templates = templateManager.getTemplatesByCategory(options.category);
      }

      if (options.tag) {
        templates = templateManager.searchTemplatesByTags([options.tag]);
      }

      if (program.getOptionValue('json')) {
        console.log(JSON.stringify(templates, null, 2));
        return;
      }

      // Display templates
      if (templates.length === 0) {
        console.log(chalk.yellow('No templates found matching the criteria.'));
        return;
      }

      console.log(chalk.bold.blue(`\n📋 Available Templates (${templates.length})\n`));

      if (options.verbose) {
        templates.forEach((template, index) => {
          console.log(chalk.bold.green(`${index + 1}. ${template.name}`));
          console.log(`   ${chalk.dim('Description:')} ${template.description}`);
          console.log(`   ${chalk.dim('Category:')} ${template.category}`);
          console.log(`   ${chalk.dim('Author:')} ${template.author}`);
          console.log(`   ${chalk.dim('Version:')} v${template.version}`);
          if (template.tags.length > 0) {
            console.log(`   ${chalk.dim('Tags:')} ${template.tags.map(tag => chalk.cyan(`#${tag}`)).join(' ')}`);
          }
          console.log(`   ${chalk.dim('File:')} ${template.file}`);
          console.log();
        });
      } else {
        // Group by category
        const byCategory = templates.reduce((acc, template) => {
          if (!acc[template.category]) {
            acc[template.category] = [];
          }
          acc[template.category].push(template);
          return acc;
        }, {} as Record<string, TemplateMetadata[]>);

        Object.keys(byCategory).sort().forEach(category => {
          console.log(chalk.bold.cyan(`📁 ${category}`));
          byCategory[category].forEach(template => {
            const tags = template.tags.length > 0 
              ? chalk.dim(`[${template.tags.join(', ')}]`)
              : '';
            console.log(`  • ${chalk.green(template.name)} - ${template.description} ${tags}`);
          });
          console.log();
        });
      }

      // Show available categories and tags
      console.log(chalk.dim('Available categories:'), templateManager.getCategories().join(', '));
      console.log(chalk.dim('Available tags:'), templateManager.getTags().join(', '));

    } catch (error) {
      console.error(chalk.red('Error listing templates:'), error.message);
      process.exit(1);
    }
  });

// templates:show command
templatesCmd
  .command('show <name>')
  .description('Show detailed information about a template')
  .action(async (name) => {
    try {
      const template = templateManager.loadTemplate(name);
      
      if (program.getOptionValue('json')) {
        console.log(JSON.stringify(template, null, 2));
        return;
      }

      console.log(chalk.bold.blue(`\n📋 Template: ${template.name}\n`));
      console.log(`${chalk.dim('Description:')} ${template.description}`);
      console.log(`${chalk.dim('Version:')} v${template.version}`);
      
      if (template.category) {
        console.log(`${chalk.dim('Category:')} ${template.category}`);
      }
      
      if (template.author) {
        console.log(`${chalk.dim('Author:')} ${template.author}`);
      }
      
      if (template.tags && template.tags.length > 0) {
        console.log(`${chalk.dim('Tags:')} ${template.tags.map(tag => chalk.cyan(`#${tag}`)).join(' ')}`);
      }

      // Show inputs if available
      if (template.inputs && template.inputs.length > 0) {
        console.log('\n' + chalk.bold.yellow('📥 Required Inputs:'));
        template.inputs.forEach(input => {
          const required = input.required ? chalk.red('*') : ' ';
          const defaultValue = input.default ? chalk.dim(` (default: ${input.default})`) : '';
          console.log(`  ${required} ${chalk.green(input.name)} (${input.type})${defaultValue}`);
          if (input.description) {
            console.log(`    ${chalk.dim(input.description)}`);
          }
        });
      }

      // Show trigger information
      if (template.trigger) {
        console.log('\n' + chalk.bold.yellow('🚀 Trigger:'));
        console.log(`  Type: ${template.trigger.type}`);
        if (template.trigger.source) {
          console.log(`  Source: ${template.trigger.source}`);
        }
        if (template.trigger.event) {
          console.log(`  Event: ${template.trigger.event}`);
        }
      }

      // Show schedule information
      if (template.schedule) {
        console.log('\n' + chalk.bold.yellow('⏰ Schedule:'));
        console.log(`  Type: ${template.schedule.type}`);
        if (template.schedule.expression) {
          console.log(`  Expression: ${template.schedule.expression}`);
        }
        if (template.schedule.timezone) {
          console.log(`  Timezone: ${template.schedule.timezone}`);
        }
      }

      // Show steps
      console.log('\n' + chalk.bold.yellow(`🔧 Steps (${template.steps.length}):`));
      template.steps.forEach((step, index) => {
        console.log(`  ${index + 1}. ${chalk.green(step.key)} - ${step.action}`);
        if (step.condition) {
          console.log(`     ${chalk.dim('Conditional step')}`);
        }
      });

      // Validate template
      const validation = templateManager.validateTemplate(template);
      if (!validation.valid) {
        console.log('\n' + chalk.red('⚠️  Template Validation Errors:'));
        validation.errors.forEach(error => {
          console.log(`  • ${error}`);
        });
      } else {
        console.log('\n' + chalk.green('✅ Template is valid'));
      }

    } catch (error) {
      console.error(chalk.red('Error showing template:'), error.message);
      process.exit(1);
    }
  });

// templates:import command
templatesCmd
  .command('import <name>')
  .description('Import a flow template into your organization')
  .option('-o, --org <orgId>', 'Organization ID')
  .option('--flow-name <name>', 'Custom name for the imported flow')
  .option('--dry-run', 'Show what would be imported without creating')
  .option('-y, --yes', 'Skip confirmation prompts')
  .action(async (name, options) => {
    try {
      // Load template
      const template = templateManager.loadTemplate(name);
      
      // Validate template
      const validation = templateManager.validateTemplate(template);
      if (!validation.valid) {
        console.error(chalk.red('Template validation failed:'));
        validation.errors.forEach(error => console.error(`  • ${error}`));
        process.exit(1);
      }

      if (options.dryRun) {
        console.log(chalk.yellow('🔍 Dry run - showing what would be imported:\n'));
        console.log(chalk.bold.blue(`Template: ${template.name}`));
        console.log(`Description: ${template.description}`);
        console.log(`Steps: ${template.steps.length}`);
        console.log(`Flow name: ${options.flowName || template.name}`);
        console.log('\nNo changes were made.');
        return;
      }

      // Get organization ID
      let orgId = options.org;
      if (!orgId) {
        const client = new TolstoyClient({
          apiUrl: program.getOptionValue('apiUrl'),
          apiKey: program.getOptionValue('apiKey')
        });

        console.log('🔍 Fetching available organizations...');
        const orgsResponse = await client.listOrganizations();
        const orgs = orgsResponse.data || [];

        if (orgs.length === 0) {
          console.error(chalk.red('No organizations found. Please create an organization first.'));
          process.exit(1);
        }

        if (orgs.length === 1) {
          orgId = orgs[0].id;
          console.log(`📁 Using organization: ${orgs[0].name} (${orgId})`);
        } else {
          const { selectedOrg } = await inquirer.prompt([
            {
              type: 'list',
              name: 'selectedOrg',
              message: 'Select an organization:',
              choices: orgs.map(org => ({
                name: `${org.name} (${org.id})`,
                value: org.id
              }))
            }
          ]);
          orgId = selectedOrg;
        }
      }

      // Confirm import
      if (!options.yes) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Import template "${template.name}" into organization ${orgId}?`,
            default: true
          }
        ]);

        if (!confirm) {
          console.log('Import cancelled.');
          return;
        }
      }

      // Create client and import
      const client = new TolstoyClient({
        apiUrl: program.getOptionValue('apiUrl'),
        apiKey: program.getOptionValue('apiKey')
      });

      console.log(chalk.blue('🚀 Importing template...'));

      const flowData = {
        ...template,
        name: options.flowName || template.name
      };

      const result = await client.createFlow(orgId, flowData);
      
      console.log(chalk.green('✅ Template imported successfully!'));
      console.log(`Flow ID: ${result.data.id}`);
      console.log(`Flow Name: ${result.data.name}`);
      console.log(`Organization: ${orgId}`);

      if (program.getOptionValue('json')) {
        console.log(JSON.stringify(result.data, null, 2));
      }

    } catch (error) {
      console.error(chalk.red('Error importing template:'), error.message);
      process.exit(1);
    }
  });

/**
 * Other commands
 */

// auth command
program
  .command('auth')
  .description('Test authentication and connection to Tolstoy API')
  .action(async () => {
    try {
      const client = new TolstoyClient({
        apiUrl: program.getOptionValue('apiUrl'),
        apiKey: program.getOptionValue('apiKey')
      });

      console.log('🔍 Testing connection to Tolstoy API...');
      const status = await client.testConnection();
      
      console.log(chalk.green('✅ Connection successful!'));
      console.log(`API Status: ${status.status || 'OK'}`);
      
      if (program.getOptionValue('json')) {
        console.log(JSON.stringify(status, null, 2));
      }
    } catch (error) {
      console.error(chalk.red('❌ Authentication failed:'), error.message);
      process.exit(1);
    }
  });

// orgs command
program
  .command('orgs')
  .description('List organizations')
  .action(async () => {
    try {
      const client = new TolstoyClient({
        apiUrl: program.getOptionValue('apiUrl'),
        apiKey: program.getOptionValue('apiKey')
      });

      const response = await client.listOrganizations();
      const orgs = response.data || [];

      if (program.getOptionValue('json')) {
        console.log(JSON.stringify(orgs, null, 2));
        return;
      }

      if (orgs.length === 0) {
        console.log(chalk.yellow('No organizations found.'));
        return;
      }

      console.log(chalk.bold.blue(`\n🏢 Organizations (${orgs.length})\n`));
      orgs.forEach((org, index) => {
        console.log(`${index + 1}. ${chalk.green(org.name)}`);
        console.log(`   ID: ${org.id}`);
        if (org.description) {
          console.log(`   Description: ${org.description}`);
        }
        console.log();
      });
    } catch (error) {
      console.error(chalk.red('Error listing organizations:'), error.message);
      process.exit(1);
    }
  });

// Error handling
program.configureHelp({
  sortSubcommands: true,
});

program.parseAsync(process.argv).catch((error) => {
  console.error(chalk.red('CLI Error:'), error.message);
  process.exit(1);
});