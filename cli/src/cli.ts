#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import dotenv from 'dotenv';

// Import existing commands
import { templateManager, TemplateMetadata } from './templates';
import { TolstoyClient } from './client';
import inquirer from 'inquirer';

// Import new commands
import { ToolAuthApiKeyCommand } from './commands/tool-auth-api-key';
import { ToolAuthOauth2Command } from './commands/tool-auth-oauth2';
import { AuthLoginCommand } from './commands/auth-login';
import { ExecuteActionCommand } from './commands/execute-action';

// Load environment variables
dotenv.config();

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
 * Templates commands (existing functionality)
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
 * Existing auth command (connection test)
 */
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

/**
 * Existing orgs command
 */
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

/**
 * Register new commands
 */

// Extract the sub-commands from the structured commands
// We need to flatten the nested command structure for proper registration

// Register tool auth commands
const toolCmd = program.command('tool').description('Tool management commands');
const toolAuthCmd = toolCmd.command('auth').description('Configure tool authentication');

toolAuthCmd
  .command('api-key')
  .description('Configure an API key for a tool')
  .requiredOption('-o, --org <orgId>', 'Organization ID')
  .requiredOption('-t, --tool <toolKey>', 'Tool key/identifier (e.g., "github", "slack")')
  .requiredOption('-k, --key <apiKey>', 'API key value')
  .option('-h, --header <headerName>', 'Header name for the API key', 'Authorization')
  .action(async (opts) => {
    const { org, tool, key, header } = opts;
    const apiUrl = process.env.API_BASE_URL || process.env.TOLSTOY_API_URL;
    
    if (!apiUrl) {
      console.error(chalk.red('Error: API_BASE_URL or TOLSTOY_API_URL environment variable not set'));
      process.exit(1);
    }

    const url = `${apiUrl}/tools/${tool}/auth`;
    
    try {
      console.log(chalk.blue(`🔧 Configuring API key for tool "${tool}"...`));
      
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Org-ID': org,
          'Authorization': `Bearer ${process.env.TOLSTOY_API_KEY || process.env.API_KEY || ''}`,
        },
        body: JSON.stringify({
          type: 'apiKey',
          config: { 
            apiKey: key,
            header: header
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(chalk.red(`Error: ${response.status} ${response.statusText}`));
        if (errorText) {
          try {
            const errorJson = JSON.parse(errorText);
            console.error(chalk.red(`Details: ${errorJson.message || errorText}`));
          } catch {
            console.error(chalk.red(`Details: ${errorText}`));
          }
        }
        process.exit(1);
      }

      const result = await response.json();
      console.log(chalk.green('✅ API key configured successfully'));
      console.log(`${chalk.dim('Tool:')} ${tool}`);
      console.log(`${chalk.dim('Organization:')} ${org}`);
      console.log(`${chalk.dim('Header:')} ${header}`);
      console.log(`${chalk.dim('Config ID:')} ${result.id}`);
      
    } catch (error) {
      console.error(chalk.red('Error configuring API key:'), error.message);
      if (error.code === 'ECONNREFUSED') {
        console.error(chalk.yellow('Hint: Make sure the Tolstoy API is running and accessible'));
      }
      process.exit(1);
    }
  });

toolAuthCmd
  .command('oauth2')
  .description('Configure OAuth2 client credentials for a tool')
  .requiredOption('-o, --org <orgId>', 'Organization ID')
  .requiredOption('-t, --tool <toolKey>', 'Tool key/identifier (e.g., "github", "google")')
  .requiredOption('-i, --client-id <clientId>', 'OAuth2 client ID')
  .requiredOption('-s, --client-secret <clientSecret>', 'OAuth2 client secret')
  .requiredOption('-c, --callback-url <callbackUrl>', 'OAuth2 callback/redirect URL')
  .option('--scope <scope>', 'OAuth2 scope (space-separated values)', '')
  .option('--authorize-url <authorizeUrl>', 'Custom authorization URL (optional)')
  .option('--token-url <tokenUrl>', 'Custom token exchange URL (optional)')
  .action(async (opts) => {
    const { 
      org, 
      tool, 
      clientId, 
      clientSecret, 
      callbackUrl, 
      scope, 
      authorizeUrl, 
      tokenUrl 
    } = opts;
    
    const apiUrl = process.env.API_BASE_URL || process.env.TOLSTOY_API_URL;
    
    if (!apiUrl) {
      console.error(chalk.red('Error: API_BASE_URL or TOLSTOY_API_URL environment variable not set'));
      process.exit(1);
    }

    const url = `${apiUrl}/tools/${tool}/auth`;
    
    try {
      console.log(chalk.blue(`🔧 Configuring OAuth2 for tool "${tool}"...`));
      
      const config: any = {
        clientId,
        clientSecret,
        redirectUri: callbackUrl,
      };

      if (scope) {
        config.scope = scope;
      }

      if (authorizeUrl) {
        config.authorizeUrl = authorizeUrl;
      }

      if (tokenUrl) {
        config.tokenUrl = tokenUrl;
      }
      
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Org-ID': org,
          'Authorization': `Bearer ${process.env.TOLSTOY_API_KEY || process.env.API_KEY || ''}`,
        },
        body: JSON.stringify({
          type: 'oauth2',
          config,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(chalk.red(`Error: ${response.status} ${response.statusText}`));
        if (errorText) {
          try {
            const errorJson = JSON.parse(errorText);
            console.error(chalk.red(`Details: ${errorJson.message || errorText}`));
          } catch {
            console.error(chalk.red(`Details: ${errorText}`));
          }
        }
        process.exit(1);
      }

      const result = await response.json();
      console.log(chalk.green('✅ OAuth2 client configured successfully'));
      console.log(`${chalk.dim('Tool:')} ${tool}`);
      console.log(`${chalk.dim('Organization:')} ${org}`);
      console.log(`${chalk.dim('Client ID:')} ${clientId}`);
      console.log(`${chalk.dim('Callback URL:')} ${callbackUrl}`);
      if (scope) {
        console.log(`${chalk.dim('Scope:')} ${scope}`);
      }
      console.log(`${chalk.dim('Config ID:')} ${result.id}`);
      
      console.log(chalk.yellow('\n💡 Next steps:'));
      console.log(`   1. Users can now run: tolstoy auth login --tool ${tool} --user <userId>`);
      console.log(`   2. This will open a browser for OAuth authorization`);
      console.log(`   3. After authorization, user tokens will be stored automatically`);
      
    } catch (error) {
      console.error(chalk.red('Error configuring OAuth2:'), error.message);
      if (error.code === 'ECONNREFUSED') {
        console.error(chalk.yellow('Hint: Make sure the Tolstoy API is running and accessible'));
      }
      process.exit(1);
    }
  });

// Register auth login command (extend existing auth command)
const authCmd = program.command('login').description('Perform user OAuth2 login for a tool')
  .requiredOption('-t, --tool <toolKey>', 'Tool key/identifier (e.g., "github", "google")')
  .requiredOption('-u, --user <userId>', 'User ID to associate with the OAuth tokens')
  .option('-o, --org <orgId>', 'Organization ID (uses ORG_ID env var if not provided)')
  .option('--no-open', 'Display the login URL instead of opening browser')
  .action(async (opts) => {
    const { tool, user, org, open: shouldOpen } = opts;
    const apiUrl = process.env.API_BASE_URL || process.env.TOLSTOY_API_URL;
    const orgId = org || process.env.ORG_ID;
    
    if (!apiUrl) {
      console.error(chalk.red('Error: API_BASE_URL or TOLSTOY_API_URL environment variable not set'));
      process.exit(1);
    }

    if (!orgId) {
      console.error(chalk.red('Error: Organization ID must be provided via --org option or ORG_ID environment variable'));
      process.exit(1);
    }

    try {
      const loginUrl = `${apiUrl}/auth/${tool}/login?userId=${encodeURIComponent(user)}`;
      
      console.log(chalk.blue(`🚀 Initiating OAuth login for tool "${tool}"`));
      console.log(`${chalk.dim('User ID:')} ${user}`);
      console.log(`${chalk.dim('Organization:')} ${orgId}`);
      console.log(`${chalk.dim('Tool:')} ${tool}`);
      console.log();
      
      if (shouldOpen) {
        console.log(chalk.yellow('📱 Opening browser for OAuth authorization...'));
        console.log(`${chalk.dim('Login URL:')} ${loginUrl}`);
        
        const open = (await import('open')).default;
        await open(loginUrl, {
          wait: false,
        });
        
        console.log();
        console.log(chalk.green('✅ Browser opened successfully'));
        console.log(chalk.blue('Please complete the authorization in your browser.'));
        console.log(chalk.blue('After approval, the callback will complete and tokens will be stored automatically.'));
        console.log();
        console.log(chalk.dim('The authorization window will show a success/error page when complete.'));
      } else {
        console.log(chalk.yellow('🔗 OAuth Login URL:'));
        console.log(loginUrl);
        console.log();
        console.log(chalk.blue('Open this URL in your browser to complete the OAuth authorization.'));
        console.log(chalk.blue('After approval, tokens will be stored automatically.'));
      }

      // Add headers that would be sent
      console.log();
      console.log(chalk.dim('Headers that will be sent:'));
      console.log(chalk.dim(`  X-Org-ID: ${orgId}`));
      console.log(chalk.dim(`  Authorization: Bearer ${process.env.TOLSTOY_API_KEY ? '[REDACTED]' : '[NOT SET]'}`));
      
    } catch (error) {
      console.error(chalk.red('Error initiating OAuth login:'), error.message);
      process.exit(1);
    }
  });

// Register actions:execute command
program
  .command('actions:execute')
  .description('Execute a single Action by key')
  .requiredOption('-o, --org <orgId>', 'Organization ID')
  .requiredOption('-k, --key <actionKey>', 'Action key/identifier')
  .option('-u, --user <userId>', 'User ID (for user-scoped authentication)')
  .option('--timeout <seconds>', 'Request timeout in seconds', '30')
  .option('--json', 'Output result in JSON format')
  .argument('<inputs>', 'JSON string of inputs for the action')
  .action(async (inputs, opts) => {
    const { org, key, user, timeout, json: jsonOutput } = opts;
    const apiUrl = process.env.API_BASE_URL || process.env.TOLSTOY_API_URL;
    
    if (!apiUrl) {
      console.error(chalk.red('Error: API_BASE_URL or TOLSTOY_API_URL environment variable not set'));
      process.exit(1);
    }

    let parsedInputs;
    try {
      parsedInputs = JSON.parse(inputs);
    } catch (error) {
      console.error(chalk.red('Error: Invalid JSON inputs provided'));
      console.error(chalk.yellow('Example: \'{"key": "value", "number": 123}\''));
      process.exit(1);
    }

    const url = `${apiUrl}/actions/${key}/execute`;
    
    try {
      if (!jsonOutput) {
        console.log(chalk.blue(`🚀 Executing action "${key}"...`));
        console.log(`${chalk.dim('Organization:')} ${org}`);
        console.log(`${chalk.dim('Action Key:')} ${key}`);
        if (user) {
          console.log(`${chalk.dim('User ID:')} ${user}`);
        }
        console.log(`${chalk.dim('Inputs:')} ${JSON.stringify(parsedInputs)}`);
        console.log();
      }
      
      const headers: any = {
        'Content-Type': 'application/json',
        'X-Org-ID': org,
        'Authorization': `Bearer ${process.env.TOLSTOY_API_KEY || process.env.API_KEY || ''}`,
      };

      if (user) {
        headers['X-User-ID'] = user;
      }
      
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(parsedInputs),
        timeout: parseInt(timeout) * 1000,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(chalk.red(`Error: ${response.status} ${response.statusText}`));
        if (errorText) {
          try {
            const errorJson = JSON.parse(errorText);
            console.error(chalk.red(`Details: ${errorJson.message || errorText}`));
          } catch {
            console.error(chalk.red(`Details: ${errorText}`));
          }
        }
        process.exit(1);
      }

      const result = await response.json();
      
      if (jsonOutput) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(chalk.green('✅ Action executed successfully'));
        
        if (result.success !== undefined) {
          console.log(`${chalk.dim('Success:')} ${result.success ? chalk.green('true') : chalk.red('false')}`);
        }
        
        if (result.executionId) {
          console.log(`${chalk.dim('Execution ID:')} ${result.executionId}`);
        }
        
        if (result.duration) {
          console.log(`${chalk.dim('Duration:')} ${result.duration}ms`);
        }

        if (result.data) {
          console.log(`${chalk.dim('Result Data:')}`);
          console.log(JSON.stringify(result.data, null, 2));
        }

        if (result.outputs) {
          console.log(`${chalk.dim('Outputs:')}`);
          console.log(JSON.stringify(result.outputs, null, 2));
        }

        if (result.error) {
          console.log(chalk.red(`Error: ${result.error}`));
        }
        
        // Show the full result as JSON for debugging
        console.log();
        console.log(chalk.dim('Full Result:'));
        console.log(JSON.stringify(result, null, 2));
      }
      
    } catch (error) {
      console.error(chalk.red('Error executing action:'), error.message);
      
      if (error.code === 'ECONNREFUSED') {
        console.error(chalk.yellow('Hint: Make sure the Tolstoy API is running and accessible'));
      } else if (error.name === 'AbortError' || error.message.includes('timeout')) {
        console.error(chalk.yellow(`Hint: Action execution timed out after ${timeout} seconds. Use --timeout to increase.`));
      }
      
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