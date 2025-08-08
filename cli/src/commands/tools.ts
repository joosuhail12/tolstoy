import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { TolstoyClient } from '../client';

export interface ToolCommandOptions {
  org?: string;
  json?: boolean;
  apiUrl?: string;
  apiKey?: string;
}

export class ToolsCommand {
  static register(program: Command): void {
    const toolsCmd = program
      .command('tools')
      .description('Manage external tools and integrations');

    // tools list
    toolsCmd
      .command('list')
      .description('List all tools')
      .option('-o, --org <orgId>', 'Organization ID')
      .option('-t, --type <type>', 'Filter by tool type')
      .option('--json', 'Output in JSON format')
      .action(async (options) => {
        try {
          const client = ToolsCommand.createClient(program, options);
          const response = await client.listTools();
          let tools = response.data || response;

          // Apply type filter if specified
          if (options.type && Array.isArray(tools)) {
            tools = tools.filter((tool: any) => tool.type === options.type);
          }

          if (options.json || program.getOptionValue('json')) {
            console.log(JSON.stringify(tools, null, 2));
            return;
          }

          if (!tools || tools.length === 0) {
            console.log(chalk.yellow('No tools found.'));
            return;
          }

          console.log(chalk.bold.blue(`\n🔧 Tools (${tools.length})\n`));
          
          // Group by type
          const byType = tools.reduce((acc: any, tool: any) => {
            if (!acc[tool.type]) {
              acc[tool.type] = [];
            }
            acc[tool.type].push(tool);
            return acc;
          }, {});

          Object.keys(byType).sort().forEach(type => {
            console.log(chalk.bold.cyan(`📁 ${type.toUpperCase()}`));
            byType[type].forEach((tool: any) => {
              console.log(`  • ${chalk.green(tool.name)} (${tool.id})`);
              if (tool.description) {
                console.log(`    ${tool.description}`);
              }
              if (tool.version) {
                console.log(`    Version: v${tool.version}`);
              }
              console.log(`    Created: ${new Date(tool.createdAt).toLocaleDateString()}`);
            });
            console.log();
          });

          // Show available types
          const types = [...new Set(tools.map((tool: any) => tool.type))];
          console.log(chalk.dim('Available types:'), types.join(', '));

        } catch (error: any) {
          console.error(chalk.red('Error listing tools:'), error.message);
          process.exit(1);
        }
      });

    // tools get
    toolsCmd
      .command('get <toolId>')
      .description('Get detailed information about a tool')
      .option('-o, --org <orgId>', 'Organization ID')
      .option('--json', 'Output in JSON format')
      .action(async (toolId, options) => {
        try {
          const client = ToolsCommand.createClient(program, options);
          const response = await client.getTool(toolId);
          const tool = response.data || response;

          if (options.json || program.getOptionValue('json')) {
            console.log(JSON.stringify(tool, null, 2));
            return;
          }

          console.log(chalk.bold.blue(`\n🔧 Tool: ${tool.name}\n`));
          console.log(`ID: ${tool.id}`);
          console.log(`Type: ${tool.type}`);
          
          if (tool.description) {
            console.log(`Description: ${tool.description}`);
          }

          if (tool.version) {
            console.log(`Version: v${tool.version}`);
          }

          console.log(`Created: ${new Date(tool.createdAt).toLocaleDateString()}`);
          console.log(`Updated: ${new Date(tool.updatedAt).toLocaleDateString()}`);

          // Show configuration
          if (tool.configuration && Object.keys(tool.configuration).length > 0) {
            console.log(chalk.bold.yellow('\n⚙️  Configuration:'));
            Object.keys(tool.configuration).forEach(key => {
              const value = tool.configuration[key];
              // Hide sensitive values
              const displayValue = key.toLowerCase().includes('secret') || 
                                 key.toLowerCase().includes('password') ||
                                 key.toLowerCase().includes('token') 
                                 ? '[HIDDEN]' 
                                 : JSON.stringify(value);
              console.log(`  ${key}: ${displayValue}`);
            });
          }

          // Show actions (if available)
          if (tool.actions && tool.actions.length > 0) {
            console.log(chalk.bold.yellow(`\n🎯 Actions (${tool.actions.length}):`));
            tool.actions.forEach((action: any, index: number) => {
              console.log(`  ${index + 1}. ${chalk.green(action.name || action.key)}`);
              if (action.description) {
                console.log(`     ${action.description}`);
              }
              if (action.method && action.endpoint) {
                console.log(`     ${action.method} ${action.endpoint}`);
              }
            });
          }

        } catch (error: any) {
          console.error(chalk.red('Error getting tool:'), error.message);
          process.exit(1);
        }
      });

    // tools create
    toolsCmd
      .command('create <name>')
      .description('Create a new tool')
      .option('-o, --org <orgId>', 'Organization ID')
      .option('-t, --type <type>', 'Tool type (notification, api, database, webhook, email)')
      .option('-d, --description <description>', 'Tool description')
      .option('-v, --version <version>', 'Tool version', '1.0.0')
      .option('-f, --file <file>', 'Load tool definition from JSON file')
      .option('--json', 'Output in JSON format')
      .action(async (name, options) => {
        try {
          const client = ToolsCommand.createClient(program, options);
          let toolData: any;

          if (options.file) {
            const fs = await import('fs');
            const fileContent = fs.readFileSync(options.file, 'utf8');
            toolData = JSON.parse(fileContent);
            toolData.name = name; // Override name from argument
          } else {
            // Interactive tool creation
            const typeChoices = ['notification', 'api', 'database', 'webhook', 'email'];
            const answers = await inquirer.prompt([
              {
                type: 'list',
                name: 'type',
                message: 'Tool type:',
                choices: typeChoices,
                default: options.type
              },
              {
                type: 'input',
                name: 'description',
                message: 'Tool description:',
                default: options.description
              },
              {
                type: 'input',
                name: 'baseUrl',
                message: 'Base URL (optional):',
                when: (answers: any) => ['api', 'webhook'].includes(answers.type)
              },
              {
                type: 'input',
                name: 'timeout',
                message: 'Timeout in milliseconds:',
                default: '5000',
                filter: (input: string) => parseInt(input) || 5000
              }
            ]);

            const configuration: any = {
              timeout: answers.timeout
            };

            if (answers.baseUrl) {
              configuration.baseUrl = answers.baseUrl;
            }

            toolData = {
              name,
              type: answers.type,
              description: answers.description,
              version: options.version,
              configuration
            };
          }

          const response = await client.createTool(toolData);
          const tool = response.data || response;

          if (options.json || program.getOptionValue('json')) {
            console.log(JSON.stringify(tool, null, 2));
            return;
          }

          console.log(chalk.green('✅ Tool created successfully!'));
          console.log(`Tool ID: ${tool.id}`);
          console.log(`Name: ${tool.name}`);
          console.log(`Type: ${tool.type}`);
          if (tool.description) {
            console.log(`Description: ${tool.description}`);
          }
          console.log(`Version: v${tool.version}`);

        } catch (error: any) {
          console.error(chalk.red('Error creating tool:'), error.message);
          process.exit(1);
        }
      });

    // tools update
    toolsCmd
      .command('update <toolId>')
      .description('Update an existing tool')
      .option('-o, --org <orgId>', 'Organization ID')
      .option('-n, --name <name>', 'New tool name')
      .option('-d, --description <description>', 'New tool description')
      .option('-v, --version <version>', 'New tool version')
      .option('-f, --file <file>', 'Load tool definition from JSON file')
      .option('--json', 'Output in JSON format')
      .action(async (toolId, options) => {
        try {
          const client = ToolsCommand.createClient(program, options);
          let updateData: any = {};

          if (options.file) {
            const fs = await import('fs');
            const fileContent = fs.readFileSync(options.file, 'utf8');
            updateData = JSON.parse(fileContent);
          } else {
            if (options.name) updateData.name = options.name;
            if (options.description) updateData.description = options.description;
            if (options.version) updateData.version = options.version;
          }

          if (Object.keys(updateData).length === 0) {
            console.log(chalk.yellow('No updates specified. Use --name, --description, --version, or --file options.'));
            return;
          }

          const response = await client.updateTool(toolId, updateData);
          const tool = response.data || response;

          if (options.json || program.getOptionValue('json')) {
            console.log(JSON.stringify(tool, null, 2));
            return;
          }

          console.log(chalk.green('✅ Tool updated successfully!'));
          console.log(`Tool ID: ${tool.id}`);
          console.log(`Name: ${tool.name}`);
          console.log(`Type: ${tool.type}`);
          if (tool.description) {
            console.log(`Description: ${tool.description}`);
          }

        } catch (error: any) {
          console.error(chalk.red('Error updating tool:'), error.message);
          process.exit(1);
        }
      });

    // tools delete
    toolsCmd
      .command('delete <toolId>')
      .description('Delete a tool')
      .option('-o, --org <orgId>', 'Organization ID')
      .option('-y, --yes', 'Skip confirmation prompt')
      .action(async (toolId, options) => {
        try {
          const client = ToolsCommand.createClient(program, options);

          // Get tool details for confirmation
          const tool = await client.getTool(toolId);
          const toolData = tool.data || tool;

          if (!options.yes) {
            const { confirm } = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'confirm',
                message: `Delete tool "${toolData.name}" (${toolId})?`,
                default: false
              }
            ]);

            if (!confirm) {
              console.log('Delete cancelled.');
              return;
            }
          }

          await client.deleteTool(toolId);
          console.log(chalk.green(`✅ Tool "${toolData.name}" deleted successfully.`));

        } catch (error: any) {
          console.error(chalk.red('Error deleting tool:'), error.message);
          process.exit(1);
        }
      });

    // tools test
    toolsCmd
      .command('test <toolId>')
      .description('Test tool connectivity and configuration')
      .option('-o, --org <orgId>', 'Organization ID')
      .option('--endpoint <endpoint>', 'Specific endpoint to test')
      .option('--json', 'Output in JSON format')
      .action(async (toolId, options) => {
        try {
          const client = ToolsCommand.createClient(program, options);
          
          if (!options.json && !program.getOptionValue('json')) {
            console.log(chalk.blue(`🧪 Testing tool connectivity...`));
          }

          // Get tool details first
          const toolResponse = await client.getTool(toolId);
          const tool = toolResponse.data || toolResponse;

          // Basic connectivity test based on tool configuration
          let testResult: any = {
            toolId,
            toolName: tool.name,
            toolType: tool.type,
            timestamp: new Date().toISOString(),
            status: 'unknown',
            tests: []
          };

          // Test 1: Configuration validation
          testResult.tests.push({
            name: 'Configuration Validation',
            status: tool.configuration && Object.keys(tool.configuration).length > 0 ? 'passed' : 'warning',
            message: tool.configuration && Object.keys(tool.configuration).length > 0 
              ? 'Tool has configuration' 
              : 'No configuration found'
          });

          // Test 2: Base URL connectivity (if applicable)
          if (tool.configuration && tool.configuration.baseUrl) {
            try {
              const fetch = (await import('node-fetch')).default;
              const testUrl = new URL(options.endpoint || '/health', tool.configuration.baseUrl).toString();
              
              const response = await fetch(testUrl, {
                method: 'GET',
                timeout: tool.configuration.timeout || 5000,
                headers: {
                  'User-Agent': 'Tolstoy-CLI/1.0'
                }
              });

              testResult.tests.push({
                name: 'Connectivity Test',
                status: response.ok ? 'passed' : 'warning',
                message: `HTTP ${response.status} ${response.statusText}`,
                url: testUrl
              });
            } catch (error: any) {
              testResult.tests.push({
                name: 'Connectivity Test',
                status: 'failed',
                message: error.message,
                url: tool.configuration.baseUrl
              });
            }
          }

          // Test 3: Authentication test (if auth config exists)
          try {
            const authResponse = await client.getToolAuth(toolId);
            testResult.tests.push({
              name: 'Authentication',
              status: 'passed',
              message: `${authResponse.type} authentication configured`
            });
          } catch (error: any) {
            testResult.tests.push({
              name: 'Authentication',
              status: 'warning',
              message: 'No authentication configuration found'
            });
          }

          // Determine overall status
          const failedTests = testResult.tests.filter((test: any) => test.status === 'failed');
          const passedTests = testResult.tests.filter((test: any) => test.status === 'passed');
          
          testResult.status = failedTests.length > 0 ? 'failed' :
                             passedTests.length > 0 ? 'passed' : 'warning';

          if (options.json || program.getOptionValue('json')) {
            console.log(JSON.stringify(testResult, null, 2));
            return;
          }

          // Display results
          const statusColor = testResult.status === 'passed' ? chalk.green :
                             testResult.status === 'failed' ? chalk.red : chalk.yellow;
          
          console.log(`\n${statusColor('●')} Tool Test Results: ${tool.name} (${toolId})`);
          console.log(`Overall Status: ${statusColor(testResult.status.toUpperCase())}`);
          console.log();

          testResult.tests.forEach((test: any) => {
            const testStatusColor = test.status === 'passed' ? chalk.green :
                                  test.status === 'failed' ? chalk.red : chalk.yellow;
            
            console.log(`${testStatusColor('●')} ${test.name}: ${testStatusColor(test.status.toUpperCase())}`);
            console.log(`   ${test.message}`);
            if (test.url) {
              console.log(`   URL: ${test.url}`);
            }
          });

          console.log();
          
          if (testResult.status === 'failed') {
            console.log(chalk.red('Some tests failed. Check tool configuration and connectivity.'));
            process.exit(1);
          } else if (testResult.status === 'warning') {
            console.log(chalk.yellow('Tests completed with warnings. Tool may have limited functionality.'));
          } else {
            console.log(chalk.green('All tests passed! Tool is ready to use.'));
          }

        } catch (error: any) {
          console.error(chalk.red('Error testing tool:'), error.message);
          process.exit(1);
        }
      });
  }

  private static createClient(program: Command, options: ToolCommandOptions): TolstoyClient {
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