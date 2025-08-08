import { Command } from 'commander';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

export const ExecuteActionCommand = new Command('actions:execute')
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