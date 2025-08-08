import { Command } from 'commander';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

export const ToolAuthApiKeyCommand = new Command('tool')
  .description('Configure tool authentication')
  .addCommand(
    new Command('auth')
      .description('Configure authentication settings for tools')
      .addCommand(
        new Command('api-key')
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
          })
      )
  );