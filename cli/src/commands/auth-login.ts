import { Command } from 'commander';
import open from 'open';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

export const AuthLoginCommand = new Command('auth')
  .description('User authentication commands')
  .addCommand(
    new Command('login')
      .description('Perform user OAuth2 login for a tool')
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
      })
  );