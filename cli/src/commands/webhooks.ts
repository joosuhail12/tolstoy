import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { TolstoyClient } from '../client';

export interface WebhookCommandOptions {
  org?: string;
  json?: boolean;
  apiUrl?: string;
  apiKey?: string;
}

export class WebhooksCommand {
  static register(program: Command): void {
    const webhooksCmd = program
      .command('webhooks')
      .description('Manage webhooks and event subscriptions');

    // webhooks list
    webhooksCmd
      .command('list')
      .description('List all webhooks')
      .option('-o, --org <orgId>', 'Organization ID')
      .option('--active-only', 'Show only active webhooks')
      .option('--json', 'Output in JSON format')
      .action(async (options) => {
        try {
          const client = WebhooksCommand.createClient(program, options);
          const response = await client.listWebhooks();
          let webhooks = response.data || response;

          // Filter active only if requested
          if (options.activeOnly && Array.isArray(webhooks)) {
            webhooks = webhooks.filter((webhook: any) => webhook.active);
          }

          if (options.json || program.getOptionValue('json')) {
            console.log(JSON.stringify(webhooks, null, 2));
            return;
          }

          if (!webhooks || webhooks.length === 0) {
            console.log(chalk.yellow('No webhooks found.'));
            return;
          }

          console.log(chalk.bold.blue(`\n🔗 Webhooks (${webhooks.length})\n`));
          
          webhooks.forEach((webhook: any, index: number) => {
            const status = webhook.active 
              ? chalk.green('Active') 
              : chalk.gray('Inactive');
            
            console.log(`${index + 1}. ${chalk.green(webhook.name)} (${webhook.id})`);
            console.log(`   URL: ${webhook.url}`);
            console.log(`   Status: ${status}`);
            
            if (webhook.events && webhook.events.length > 0) {
              console.log(`   Events: ${webhook.events.join(', ')}`);
            }
            
            if (webhook.secret) {
              console.log(`   Secret: ${chalk.dim('***configured***')}`);
            }
            
            console.log(`   Created: ${new Date(webhook.createdAt).toLocaleDateString()}`);
            console.log();
          });

          // Summary
          const activeCount = webhooks.filter((w: any) => w.active).length;
          const inactiveCount = webhooks.length - activeCount;
          console.log(chalk.dim(`Active: ${activeCount}, Inactive: ${inactiveCount}`));

        } catch (error: any) {
          console.error(chalk.red('Error listing webhooks:'), error.message);
          process.exit(1);
        }
      });

    // webhooks get
    webhooksCmd
      .command('get <webhookId>')
      .description('Get detailed information about a webhook')
      .option('-o, --org <orgId>', 'Organization ID')
      .option('--json', 'Output in JSON format')
      .action(async (webhookId, options) => {
        try {
          const client = WebhooksCommand.createClient(program, options);
          const response = await client.getWebhook(webhookId);
          const webhook = response.data || response;

          if (options.json || program.getOptionValue('json')) {
            console.log(JSON.stringify(webhook, null, 2));
            return;
          }

          console.log(chalk.bold.blue(`\n🔗 Webhook: ${webhook.name}\n`));
          console.log(`ID: ${webhook.id}`);
          console.log(`URL: ${webhook.url}`);
          console.log(`Status: ${webhook.active ? chalk.green('Active') : chalk.gray('Inactive')}`);
          
          if (webhook.description) {
            console.log(`Description: ${webhook.description}`);
          }

          console.log(`Created: ${new Date(webhook.createdAt).toLocaleDateString()}`);
          console.log(`Updated: ${new Date(webhook.updatedAt).toLocaleDateString()}`);

          // Show events
          if (webhook.events && webhook.events.length > 0) {
            console.log(chalk.bold.yellow('\n📡 Subscribed Events:'));
            webhook.events.forEach((event: string, index: number) => {
              console.log(`  ${index + 1}. ${event}`);
            });
          }

          // Show security info
          console.log(chalk.bold.yellow('\n🔐 Security:'));
          if (webhook.secret) {
            console.log(`  Secret: ${chalk.green('Configured')}`);
            console.log(`  ${chalk.dim('Webhook signatures will be validated')}`);
          } else {
            console.log(`  Secret: ${chalk.yellow('Not configured')}`);
            console.log(`  ${chalk.dim('Webhook signatures will not be validated')}`);
          }

          // Show headers if available
          if (webhook.headers && Object.keys(webhook.headers).length > 0) {
            console.log(chalk.bold.yellow('\n📋 Custom Headers:'));
            Object.keys(webhook.headers).forEach(key => {
              const value = key.toLowerCase().includes('secret') || 
                           key.toLowerCase().includes('token') || 
                           key.toLowerCase().includes('key')
                           ? '[HIDDEN]' 
                           : webhook.headers[key];
              console.log(`  ${key}: ${value}`);
            });
          }

          // Show retry policy if available
          if (webhook.retryPolicy) {
            console.log(chalk.bold.yellow('\n🔄 Retry Policy:'));
            console.log(`  Max Attempts: ${webhook.retryPolicy.maxAttempts || 'N/A'}`);
            console.log(`  Retry Delay: ${webhook.retryPolicy.retryDelay || 'N/A'}ms`);
            console.log(`  Timeout: ${webhook.retryPolicy.timeout || 'N/A'}ms`);
          }

        } catch (error: any) {
          console.error(chalk.red('Error getting webhook:'), error.message);
          process.exit(1);
        }
      });

    // webhooks create
    webhooksCmd
      .command('create <name> <url>')
      .description('Create a new webhook')
      .option('-o, --org <orgId>', 'Organization ID')
      .option('-d, --description <description>', 'Webhook description')
      .option('-e, --events <events>', 'Comma-separated list of events to subscribe to')
      .option('-s, --secret <secret>', 'Webhook secret for signature validation')
      .option('--active <active>', 'Set webhook active status (true/false)', 'true')
      .option('-f, --file <file>', 'Load webhook definition from JSON file')
      .option('--json', 'Output in JSON format')
      .action(async (name, url, options) => {
        try {
          const client = WebhooksCommand.createClient(program, options);
          let webhookData: any;

          if (options.file) {
            const fs = await import('fs');
            const fileContent = fs.readFileSync(options.file, 'utf8');
            webhookData = JSON.parse(fileContent);
            webhookData.name = name; // Override name from argument
            webhookData.url = url; // Override URL from argument
          } else {
            // Interactive webhook creation
            const commonEvents = [
              'flow.started',
              'flow.completed',
              'flow.failed',
              'action.started',
              'action.completed',
              'action.failed',
              'user.created',
              'user.updated',
              'tool.connected',
              'tool.disconnected'
            ];

            const answers = await inquirer.prompt([
              {
                type: 'input',
                name: 'description',
                message: 'Webhook description (optional):',
                default: options.description
              },
              {
                type: 'checkbox',
                name: 'events',
                message: 'Select events to subscribe to:',
                choices: commonEvents,
                default: options.events ? options.events.split(',').map((e: string) => e.trim()) : []
              },
              {
                type: 'input',
                name: 'customEvents',
                message: 'Additional custom events (comma-separated):',
                when: (answers: any) => answers.events.length === 0
              },
              {
                type: 'input',
                name: 'secret',
                message: 'Webhook secret (for signature validation):',
                default: options.secret
              },
              {
                type: 'confirm',
                name: 'active',
                message: 'Make webhook active?',
                default: options.active === 'true'
              }
            ]);

            let events = answers.events || [];
            if (answers.customEvents) {
              events = events.concat(answers.customEvents.split(',').map((e: string) => e.trim()));
            }

            webhookData = {
              name,
              url,
              description: answers.description,
              events: events.filter((e: string) => e.length > 0),
              secret: answers.secret,
              active: answers.active
            };
          }

          const response = await client.createWebhook(webhookData);
          const webhook = response.data || response;

          if (options.json || program.getOptionValue('json')) {
            console.log(JSON.stringify(webhook, null, 2));
            return;
          }

          console.log(chalk.green('✅ Webhook created successfully!'));
          console.log(`Webhook ID: ${webhook.id}`);
          console.log(`Name: ${webhook.name}`);
          console.log(`URL: ${webhook.url}`);
          console.log(`Status: ${webhook.active ? chalk.green('Active') : chalk.gray('Inactive')}`);
          
          if (webhook.events && webhook.events.length > 0) {
            console.log(`Events: ${webhook.events.join(', ')}`);
          }
          
          if (webhook.secret) {
            console.log(`Secret: ${chalk.green('Configured')}`);
          }

        } catch (error: any) {
          console.error(chalk.red('Error creating webhook:'), error.message);
          process.exit(1);
        }
      });

    // webhooks update
    webhooksCmd
      .command('update <webhookId>')
      .description('Update an existing webhook')
      .option('-o, --org <orgId>', 'Organization ID')
      .option('-n, --name <name>', 'New webhook name')
      .option('-u, --url <url>', 'New webhook URL')
      .option('-d, --description <description>', 'New webhook description')
      .option('-e, --events <events>', 'Comma-separated list of events to subscribe to')
      .option('-s, --secret <secret>', 'New webhook secret')
      .option('--active <active>', 'Set webhook active status (true/false)')
      .option('-f, --file <file>', 'Load webhook definition from JSON file')
      .option('--json', 'Output in JSON format')
      .action(async (webhookId, options) => {
        try {
          const client = WebhooksCommand.createClient(program, options);
          let updateData: any = {};

          if (options.file) {
            const fs = await import('fs');
            const fileContent = fs.readFileSync(options.file, 'utf8');
            updateData = JSON.parse(fileContent);
          } else {
            if (options.name) updateData.name = options.name;
            if (options.url) updateData.url = options.url;
            if (options.description) updateData.description = options.description;
            if (options.events) {
              updateData.events = options.events.split(',').map((e: string) => e.trim());
            }
            if (options.secret) updateData.secret = options.secret;
            if (options.active !== undefined) {
              updateData.active = options.active === 'true';
            }
          }

          if (Object.keys(updateData).length === 0) {
            console.log(chalk.yellow('No updates specified. Use --name, --url, --description, --events, --secret, --active, or --file options.'));
            return;
          }

          const response = await client.updateWebhook(webhookId, updateData);
          const webhook = response.data || response;

          if (options.json || program.getOptionValue('json')) {
            console.log(JSON.stringify(webhook, null, 2));
            return;
          }

          console.log(chalk.green('✅ Webhook updated successfully!'));
          console.log(`Webhook ID: ${webhook.id}`);
          console.log(`Name: ${webhook.name}`);
          console.log(`URL: ${webhook.url}`);
          console.log(`Status: ${webhook.active ? chalk.green('Active') : chalk.gray('Inactive')}`);

        } catch (error: any) {
          console.error(chalk.red('Error updating webhook:'), error.message);
          process.exit(1);
        }
      });

    // webhooks delete
    webhooksCmd
      .command('delete <webhookId>')
      .description('Delete a webhook')
      .option('-o, --org <orgId>', 'Organization ID')
      .option('-y, --yes', 'Skip confirmation prompt')
      .action(async (webhookId, options) => {
        try {
          const client = WebhooksCommand.createClient(program, options);

          // Get webhook details for confirmation
          const webhook = await client.getWebhook(webhookId);
          const webhookData = webhook.data || webhook;

          if (!options.yes) {
            const { confirm } = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'confirm',
                message: `Delete webhook "${webhookData.name}" (${webhookId})?`,
                default: false
              }
            ]);

            if (!confirm) {
              console.log('Delete cancelled.');
              return;
            }
          }

          await client.deleteWebhook(webhookId);
          console.log(chalk.green(`✅ Webhook "${webhookData.name}" deleted successfully.`));

        } catch (error: any) {
          console.error(chalk.red('Error deleting webhook:'), error.message);
          process.exit(1);
        }
      });

    // webhooks test
    webhooksCmd
      .command('test <webhookId>')
      .description('Test webhook by sending a test payload')
      .option('-o, --org <orgId>', 'Organization ID')
      .option('-e, --event <event>', 'Event type to test', 'test.webhook')
      .option('-p, --payload <payload>', 'JSON payload to send')
      .option('--json', 'Output in JSON format')
      .action(async (webhookId, options) => {
        try {
          const client = WebhooksCommand.createClient(program, options);
          
          // Get webhook details
          const webhookResponse = await client.getWebhook(webhookId);
          const webhook = webhookResponse.data || webhookResponse;

          if (!webhook.active) {
            console.log(chalk.yellow('⚠️  Warning: Webhook is inactive. Test may not behave as expected.'));
          }

          let testPayload: any;
          if (options.payload) {
            try {
              testPayload = JSON.parse(options.payload);
            } catch (error) {
              console.error(chalk.red('Error: Invalid JSON payload provided'));
              process.exit(1);
            }
          } else {
            // Default test payload
            testPayload = {
              event: options.event,
              timestamp: new Date().toISOString(),
              data: {
                test: true,
                webhookId: webhookId,
                message: 'This is a test webhook delivery'
              }
            };
          }

          if (!options.json && !program.getOptionValue('json')) {
            console.log(chalk.blue(`🧪 Testing webhook: ${webhook.name}`));
            console.log(`URL: ${webhook.url}`);
            console.log(`Event: ${options.event}`);
            console.log(`Payload: ${JSON.stringify(testPayload, null, 2)}`);
            console.log();
          }

          // Send test request
          const fetch = (await import('node-fetch')).default;
          const headers: any = {
            'Content-Type': 'application/json',
            'User-Agent': 'Tolstoy-CLI/1.0',
            'X-Webhook-Test': 'true'
          };

          // Add custom headers if configured
          if (webhook.headers) {
            Object.assign(headers, webhook.headers);
          }

          // Generate signature if secret is configured
          if (webhook.secret) {
            const crypto = await import('crypto');
            const signature = crypto
              .createHmac('sha256', webhook.secret)
              .update(JSON.stringify(testPayload))
              .digest('hex');
            headers['X-Webhook-Signature'] = `sha256=${signature}`;
          }

          const startTime = Date.now();
          let testResult: any = {
            webhookId,
            webhookName: webhook.name,
            url: webhook.url,
            event: options.event,
            timestamp: new Date().toISOString(),
            success: false,
            duration: 0,
            statusCode: 0,
            statusText: '',
            error: null
          };

          try {
            const response = await fetch(webhook.url, {
              method: 'POST',
              headers,
              body: JSON.stringify(testPayload),
              timeout: 30000
            });

            testResult.duration = Date.now() - startTime;
            testResult.statusCode = response.status;
            testResult.statusText = response.statusText;
            testResult.success = response.ok;

            if (options.json || program.getOptionValue('json')) {
              console.log(JSON.stringify(testResult, null, 2));
              return;
            }

            const statusColor = testResult.success ? chalk.green : chalk.red;
            console.log(`${statusColor('●')} Test Result: ${statusColor(testResult.success ? 'SUCCESS' : 'FAILED')}`);
            console.log(`Status: ${testResult.statusCode} ${testResult.statusText}`);
            console.log(`Duration: ${testResult.duration}ms`);

            if (testResult.success) {
              console.log(chalk.green('✅ Webhook test completed successfully!'));
            } else {
              console.log(chalk.red(`❌ Webhook test failed with status ${testResult.statusCode}`));
            }

          } catch (error: any) {
            testResult.duration = Date.now() - startTime;
            testResult.error = error.message;

            if (options.json || program.getOptionValue('json')) {
              console.log(JSON.stringify(testResult, null, 2));
              return;
            }

            console.log(chalk.red('❌ Webhook test failed with error:'));
            console.log(`Error: ${error.message}`);
            console.log(`Duration: ${testResult.duration}ms`);
            
            if (error.code === 'ECONNREFUSED') {
              console.log(chalk.yellow('Hint: Check if the webhook URL is accessible and accepting connections'));
            } else if (error.name === 'AbortError' || error.message.includes('timeout')) {
              console.log(chalk.yellow('Hint: Webhook endpoint took too long to respond (>30s)'));
            }
            
            process.exit(1);
          }

        } catch (error: any) {
          console.error(chalk.red('Error testing webhook:'), error.message);
          process.exit(1);
        }
      });
  }

  private static createClient(program: Command, options: WebhookCommandOptions): TolstoyClient {
    const apiUrl = options.apiUrl || program.getOptionValue('apiUrl') || process.env.TOLSTOY_API_URL || process.env.API_BASE_URL;
    const apiKey = options.apiKey || program.getOptionValue('apiKey') || process.env.TOLSTOY_API_KEY || process.env.API_KEY;
    const orgId = options.org || process.env.ORG_ID || process.env.TOLSTOY_ORG_ID;

    if (!apiUrl) {
      console.error(chalk.red('Error: API URL not specified. Use --api-url option or set TOLSTOY_API_URL environment variable.'));
      process.exit(1);
    }

    if (!apiKey) {
      console.error(chalk.red('Error: API key not specified. Use --api-key option or set TOLSTOY_API_KEY environment variable.'));
      process.exit(1);
    }

    return new TolstoyClient({
      baseURL: apiUrl,
      orgId,
      token: apiKey,
    });
  }
}