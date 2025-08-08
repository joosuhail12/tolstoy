import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { TolstoyClient } from '../client';

export interface FlowCommandOptions {
  org?: string;
  json?: boolean;
  apiUrl?: string;
  apiKey?: string;
}

export class FlowsCommand {
  static register(program: Command): void {
    const flowsCmd = program
      .command('flows')
      .description('Manage workflow flows');

    // flows list
    flowsCmd
      .command('list')
      .description('List all flows')
      .option('-o, --org <orgId>', 'Organization ID')
      .option('--json', 'Output in JSON format')
      .action(async (options) => {
        try {
          const client = FlowsCommand.createClient(program, options);
          const response = await client.listFlows();
          const flows = response.data || response;

          if (options.json || program.getOptionValue('json')) {
            console.log(JSON.stringify(flows, null, 2));
            return;
          }

          if (!flows || flows.length === 0) {
            console.log(chalk.yellow('No flows found.'));
            return;
          }

          console.log(chalk.bold.blue(`\n🔄 Flows (${flows.length})\n`));
          
          flows.forEach((flow: any, index: number) => {
            const status = flow.active 
              ? chalk.green('Active') 
              : chalk.gray('Inactive');
            
            console.log(`${index + 1}. ${chalk.green(flow.name)} (${flow.id})`);
            console.log(`   Status: ${status}`);
            
            if (flow.description) {
              console.log(`   Description: ${flow.description}`);
            }
            
            if (flow.steps) {
              console.log(`   Steps: ${flow.steps.length}`);
            }
            
            if (flow.triggers) {
              console.log(`   Triggers: ${flow.triggers.length}`);
            }
            
            console.log(`   Created: ${new Date(flow.createdAt).toLocaleDateString()}`);
            console.log();
          });
        } catch (error: any) {
          console.error(chalk.red('Error listing flows:'), error.message);
          process.exit(1);
        }
      });

    // flows get
    flowsCmd
      .command('get <flowId>')
      .description('Get detailed information about a flow')
      .option('-o, --org <orgId>', 'Organization ID')
      .option('--json', 'Output in JSON format')
      .action(async (flowId, options) => {
        try {
          const client = FlowsCommand.createClient(program, options);
          const response = await client.getFlow(flowId);
          const flow = response.data || response;

          if (options.json || program.getOptionValue('json')) {
            console.log(JSON.stringify(flow, null, 2));
            return;
          }

          console.log(chalk.bold.blue(`\n🔄 Flow: ${flow.name}\n`));
          console.log(`ID: ${flow.id}`);
          console.log(`Status: ${flow.active ? chalk.green('Active') : chalk.gray('Inactive')}`);
          
          if (flow.description) {
            console.log(`Description: ${flow.description}`);
          }

          if (flow.version) {
            console.log(`Version: v${flow.version}`);
          }

          console.log(`Created: ${new Date(flow.createdAt).toLocaleDateString()}`);
          console.log(`Updated: ${new Date(flow.updatedAt).toLocaleDateString()}`);

          // Show triggers
          if (flow.triggers && flow.triggers.length > 0) {
            console.log(chalk.bold.yellow('\n🚀 Triggers:'));
            flow.triggers.forEach((trigger: any, index: number) => {
              console.log(`  ${index + 1}. Type: ${trigger.type}`);
              if (trigger.config) {
                Object.keys(trigger.config).forEach(key => {
                  console.log(`     ${key}: ${JSON.stringify(trigger.config[key])}`);
                });
              }
            });
          }

          // Show steps
          if (flow.steps && flow.steps.length > 0) {
            console.log(chalk.bold.yellow(`\n🔧 Steps (${flow.steps.length}):`));
            flow.steps.forEach((step: any, index: number) => {
              console.log(`  ${index + 1}. ${chalk.green(step.name || step.id)}`);
              console.log(`     Type: ${step.type}`);
              if (step.actionId) {
                console.log(`     Action: ${step.actionId}`);
              }
              if (step.dependencies && step.dependencies.length > 0) {
                console.log(`     Dependencies: ${step.dependencies.join(', ')}`);
              }
            });
          }

          // Show settings
          if (flow.settings) {
            console.log(chalk.bold.yellow('\n⚙️  Settings:'));
            Object.keys(flow.settings).forEach(key => {
              console.log(`  ${key}: ${JSON.stringify(flow.settings[key])}`);
            });
          }

        } catch (error: any) {
          console.error(chalk.red('Error getting flow:'), error.message);
          process.exit(1);
        }
      });

    // flows create
    flowsCmd
      .command('create <name>')
      .description('Create a new flow')
      .option('-o, --org <orgId>', 'Organization ID')
      .option('-d, --description <description>', 'Flow description')
      .option('-f, --file <file>', 'Load flow definition from JSON file')
      .option('--json', 'Output in JSON format')
      .action(async (name, options) => {
        try {
          const client = FlowsCommand.createClient(program, options);
          let flowData: any;

          if (options.file) {
            const fs = await import('fs');
            const fileContent = fs.readFileSync(options.file, 'utf8');
            flowData = JSON.parse(fileContent);
            flowData.name = name; // Override name from argument
          } else {
            // Interactive flow creation
            const answers = await inquirer.prompt([
              {
                type: 'input',
                name: 'description',
                message: 'Flow description:',
                default: options.description
              },
              {
                type: 'confirm',
                name: 'active',
                message: 'Make flow active?',
                default: true
              }
            ]);

            flowData = {
              name,
              description: answers.description,
              active: answers.active,
              steps: [],
              triggers: [],
              settings: {}
            };
          }

          const response = await client.createFlow(flowData);
          const flow = response.data || response;

          if (options.json || program.getOptionValue('json')) {
            console.log(JSON.stringify(flow, null, 2));
            return;
          }

          console.log(chalk.green('✅ Flow created successfully!'));
          console.log(`Flow ID: ${flow.id}`);
          console.log(`Name: ${flow.name}`);
          if (flow.description) {
            console.log(`Description: ${flow.description}`);
          }
          console.log(`Status: ${flow.active ? chalk.green('Active') : chalk.gray('Inactive')}`);

        } catch (error: any) {
          console.error(chalk.red('Error creating flow:'), error.message);
          process.exit(1);
        }
      });

    // flows update
    flowsCmd
      .command('update <flowId>')
      .description('Update an existing flow')
      .option('-o, --org <orgId>', 'Organization ID')
      .option('-n, --name <name>', 'New flow name')
      .option('-d, --description <description>', 'New flow description')
      .option('--active <active>', 'Set flow active status (true/false)')
      .option('-f, --file <file>', 'Load flow definition from JSON file')
      .option('--json', 'Output in JSON format')
      .action(async (flowId, options) => {
        try {
          const client = FlowsCommand.createClient(program, options);
          let updateData: any = {};

          if (options.file) {
            const fs = await import('fs');
            const fileContent = fs.readFileSync(options.file, 'utf8');
            updateData = JSON.parse(fileContent);
          } else {
            if (options.name) updateData.name = options.name;
            if (options.description) updateData.description = options.description;
            if (options.active !== undefined) {
              updateData.active = options.active === 'true';
            }
          }

          if (Object.keys(updateData).length === 0) {
            console.log(chalk.yellow('No updates specified. Use --name, --description, --active, or --file options.'));
            return;
          }

          const response = await client.updateFlow(flowId, updateData);
          const flow = response.data || response;

          if (options.json || program.getOptionValue('json')) {
            console.log(JSON.stringify(flow, null, 2));
            return;
          }

          console.log(chalk.green('✅ Flow updated successfully!'));
          console.log(`Flow ID: ${flow.id}`);
          console.log(`Name: ${flow.name}`);
          if (flow.description) {
            console.log(`Description: ${flow.description}`);
          }
          console.log(`Status: ${flow.active ? chalk.green('Active') : chalk.gray('Inactive')}`);

        } catch (error: any) {
          console.error(chalk.red('Error updating flow:'), error.message);
          process.exit(1);
        }
      });

    // flows delete
    flowsCmd
      .command('delete <flowId>')
      .description('Delete a flow')
      .option('-o, --org <orgId>', 'Organization ID')
      .option('-y, --yes', 'Skip confirmation prompt')
      .action(async (flowId, options) => {
        try {
          const client = FlowsCommand.createClient(program, options);

          // Get flow details for confirmation
          const flow = await client.getFlow(flowId);
          const flowData = flow.data || flow;

          if (!options.yes) {
            const { confirm } = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'confirm',
                message: `Delete flow "${flowData.name}" (${flowId})?`,
                default: false
              }
            ]);

            if (!confirm) {
              console.log('Delete cancelled.');
              return;
            }
          }

          await client.deleteFlow(flowId);
          console.log(chalk.green(`✅ Flow "${flowData.name}" deleted successfully.`));

        } catch (error: any) {
          console.error(chalk.red('Error deleting flow:'), error.message);
          process.exit(1);
        }
      });

    // flows execute
    flowsCmd
      .command('execute <flowId>')
      .description('Execute a flow')
      .argument('<inputs>', 'JSON string of inputs for the flow')
      .option('-o, --org <orgId>', 'Organization ID')
      .option('-u, --user <userId>', 'User ID (for user-scoped execution)')
      .option('--no-durable', 'Disable durable execution')
      .option('--timeout <seconds>', 'Execution timeout in seconds', '300')
      .option('--json', 'Output in JSON format')
      .action(async (flowId, inputs, options) => {
        try {
          const client = FlowsCommand.createClient(program, options);
          
          let parsedInputs;
          try {
            parsedInputs = JSON.parse(inputs);
          } catch (error) {
            console.error(chalk.red('Error: Invalid JSON inputs provided'));
            console.error(chalk.yellow('Example: \'{"key": "value", "number": 123}\''));
            process.exit(1);
          }

          const executionOptions: any = {
            useDurable: options.durable !== false,
            orgId: options.org
          };

          if (!options.json && !program.getOptionValue('json')) {
            console.log(chalk.blue(`🚀 Executing flow "${flowId}"...`));
            console.log(`Inputs: ${JSON.stringify(parsedInputs)}`);
            console.log(`Durable: ${executionOptions.useDurable}`);
            console.log();
          }

          const response = await client.runFlowWithAuth(flowId, parsedInputs, executionOptions);
          const result = response.data || response;

          if (options.json || program.getOptionValue('json')) {
            console.log(JSON.stringify(result, null, 2));
            return;
          }

          console.log(chalk.green('✅ Flow execution started!'));
          console.log(`Execution ID: ${result.executionId || result.id}`);
          
          if (result.status) {
            const statusColor = result.status === 'completed' ? chalk.green :
                              result.status === 'failed' ? chalk.red :
                              result.status === 'running' ? chalk.blue : chalk.yellow;
            console.log(`Status: ${statusColor(result.status)}`);
          }

          if (result.duration) {
            console.log(`Duration: ${result.duration}ms`);
          }

          if (result.results) {
            console.log('\nResults:');
            console.log(JSON.stringify(result.results, null, 2));
          }

          if (result.error) {
            console.log(chalk.red(`\nError: ${result.error}`));
          }

        } catch (error: any) {
          console.error(chalk.red('Error executing flow:'), error.message);
          
          if (error.code === 'ECONNREFUSED') {
            console.error(chalk.yellow('Hint: Make sure the Tolstoy API is running and accessible'));
          } else if (error.name === 'AbortError' || error.message.includes('timeout')) {
            console.error(chalk.yellow(`Hint: Flow execution timed out after ${options.timeout} seconds. Use --timeout to increase.`));
          }
          
          process.exit(1);
        }
      });

    // flows logs
    flowsCmd
      .command('logs <flowId>')
      .description('Get execution logs for a flow')
      .option('-o, --org <orgId>', 'Organization ID')
      .option('-e, --execution <executionId>', 'Specific execution ID')
      .option('-l, --limit <limit>', 'Limit number of log entries', '50')
      .option('--follow', 'Follow logs in real-time')
      .option('--json', 'Output in JSON format')
      .action(async (flowId, options) => {
        try {
          const client = FlowsCommand.createClient(program, options);
          
          // Note: This assumes your API has execution logs endpoint
          // You may need to adapt this based on your actual API structure
          let logs;
          
          if (options.execution) {
            // Get logs for specific execution
            logs = await client.getFlowExecution(flowId, options.execution);
          } else {
            // Get recent executions for the flow
            const executions = await client.raw.flows.executions.list(flowId, {
              limit: parseInt(options.limit)
            });
            logs = executions.data || executions;
          }

          if (options.json || program.getOptionValue('json')) {
            console.log(JSON.stringify(logs, null, 2));
            return;
          }

          if (!logs || (Array.isArray(logs) && logs.length === 0)) {
            console.log(chalk.yellow(`No logs found for flow ${flowId}.`));
            return;
          }

          console.log(chalk.bold.blue(`\n📋 Flow Logs: ${flowId}\n`));
          
          const logEntries = Array.isArray(logs) ? logs : [logs];
          logEntries.forEach((log: any) => {
            const statusColor = log.status === 'completed' ? chalk.green :
                              log.status === 'failed' ? chalk.red :
                              log.status === 'running' ? chalk.blue : chalk.yellow;
            
            console.log(`${chalk.dim(new Date(log.startedAt).toLocaleString())} ${statusColor(log.status.toUpperCase())}`);
            
            if (log.id || log.executionId) {
              console.log(`  Execution ID: ${log.id || log.executionId}`);
            }
            
            if (log.duration) {
              console.log(`  Duration: ${log.duration}ms`);
            }
            
            if (log.error) {
              console.log(chalk.red(`  Error: ${log.error}`));
            }
            
            if (log.variables && Object.keys(log.variables).length > 0) {
              console.log(`  Variables: ${JSON.stringify(log.variables, null, 2)}`);
            }
            
            console.log();
          });

          if (options.follow) {
            console.log(chalk.dim('Following logs... Press Ctrl+C to stop.'));
            // Note: Real-time log following would require WebSocket or polling implementation
            console.log(chalk.yellow('Real-time log following not yet implemented.'));
          }

        } catch (error: any) {
          console.error(chalk.red('Error getting flow logs:'), error.message);
          process.exit(1);
        }
      });
  }

  private static createClient(program: Command, options: FlowCommandOptions): TolstoyClient {
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