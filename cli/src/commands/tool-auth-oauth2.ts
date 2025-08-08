import { Command } from 'commander';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

export const ToolAuthOauth2Command = new Command('tool')
  .description('Configure tool authentication')
  .addCommand(
    new Command('auth')
      .description('Configure authentication settings for tools')
      .addCommand(
        new Command('oauth2')
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
          })
      )
  );