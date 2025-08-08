import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { TolstoyClient } from '../client';

export interface UserCommandOptions {
  org?: string;
  json?: boolean;
  apiUrl?: string;
  apiKey?: string;
}

export class UsersCommand {
  static register(program: Command): void {
    const usersCmd = program
      .command('users')
      .description('Manage users and user accounts');

    // users list
    usersCmd
      .command('list')
      .description('List all users')
      .option('-o, --org <orgId>', 'Organization ID')
      .option('-l, --limit <limit>', 'Limit number of results', '50')
      .option('--active-only', 'Show only active users')
      .option('--json', 'Output in JSON format')
      .action(async (options) => {
        try {
          const client = UsersCommand.createClient(program, options);
          
          // Build query parameters
          const queryParams: any = {
            limit: parseInt(options.limit)
          };

          if (options.activeOnly) {
            queryParams.active = true;
          }

          const response = await client.raw.users.list(queryParams);
          let users = response.data || response;

          if (options.json || program.getOptionValue('json')) {
            console.log(JSON.stringify(users, null, 2));
            return;
          }

          if (!users || users.length === 0) {
            console.log(chalk.yellow('No users found.'));
            return;
          }

          console.log(chalk.bold.blue(`\n👥 Users (${users.length})\n`));
          
          users.forEach((user: any, index: number) => {
            const status = user.active !== false 
              ? chalk.green('Active') 
              : chalk.gray('Inactive');
            
            console.log(`${index + 1}. ${chalk.green(user.name || user.email || user.id)}`);
            console.log(`   ID: ${user.id}`);
            
            if (user.email) {
              console.log(`   Email: ${user.email}`);
            }
            
            if (user.name && user.name !== user.email) {
              console.log(`   Name: ${user.name}`);
            }
            
            console.log(`   Status: ${status}`);
            
            if (user.role) {
              console.log(`   Role: ${user.role}`);
            }
            
            if (user.lastActiveAt) {
              console.log(`   Last Active: ${new Date(user.lastActiveAt).toLocaleDateString()}`);
            }
            
            console.log(`   Created: ${new Date(user.createdAt).toLocaleDateString()}`);
            console.log();
          });

          // Summary stats
          const activeCount = users.filter((u: any) => u.active !== false).length;
          const inactiveCount = users.length - activeCount;
          
          console.log(chalk.dim(`Active: ${activeCount}, Inactive: ${inactiveCount}`));

        } catch (error: any) {
          console.error(chalk.red('Error listing users:'), error.message);
          process.exit(1);
        }
      });

    // users get
    usersCmd
      .command('get <userId>')
      .description('Get detailed information about a user')
      .option('-o, --org <orgId>', 'Organization ID')
      .option('--json', 'Output in JSON format')
      .action(async (userId, options) => {
        try {
          const client = UsersCommand.createClient(program, options);
          const response = await client.raw.users.retrieve(userId);
          const user = response.data || response;

          if (options.json || program.getOptionValue('json')) {
            console.log(JSON.stringify(user, null, 2));
            return;
          }

          console.log(chalk.bold.blue(`\n👤 User: ${user.name || user.email || user.id}\n`));
          console.log(`ID: ${user.id}`);
          
          if (user.email) {
            console.log(`Email: ${user.email}`);
          }
          
          if (user.name) {
            console.log(`Name: ${user.name}`);
          }
          
          const status = user.active !== false 
            ? chalk.green('Active') 
            : chalk.gray('Inactive');
          console.log(`Status: ${status}`);
          
          if (user.role) {
            console.log(`Role: ${user.role}`);
          }
          
          if (user.permissions && user.permissions.length > 0) {
            console.log(`Permissions: ${user.permissions.join(', ')}`);
          }
          
          console.log(`Created: ${new Date(user.createdAt).toLocaleDateString()}`);
          console.log(`Updated: ${new Date(user.updatedAt).toLocaleDateString()}`);
          
          if (user.lastActiveAt) {
            console.log(`Last Active: ${new Date(user.lastActiveAt).toLocaleString()}`);
          }

          // Show profile information if available
          if (user.profile && Object.keys(user.profile).length > 0) {
            console.log(chalk.bold.yellow('\n📋 Profile:'));
            Object.keys(user.profile).forEach(key => {
              console.log(`  ${key}: ${user.profile[key]}`);
            });
          }

          // Show settings if available
          if (user.settings && Object.keys(user.settings).length > 0) {
            console.log(chalk.bold.yellow('\n⚙️  Settings:'));
            Object.keys(user.settings).forEach(key => {
              console.log(`  ${key}: ${JSON.stringify(user.settings[key])}`);
            });
          }

        } catch (error: any) {
          console.error(chalk.red('Error getting user:'), error.message);
          process.exit(1);
        }
      });

    // users create
    usersCmd
      .command('create')
      .description('Create a new user')
      .option('-o, --org <orgId>', 'Organization ID')
      .option('-e, --email <email>', 'User email address')
      .option('-n, --name <name>', 'User full name')
      .option('-r, --role <role>', 'User role (admin, user, viewer)')
      .option('--active <active>', 'Set user active status (true/false)', 'true')
      .option('-f, --file <file>', 'Load user definition from JSON file')
      .option('--json', 'Output in JSON format')
      .action(async (options) => {
        try {
          const client = UsersCommand.createClient(program, options);
          let userData: any;

          if (options.file) {
            const fs = await import('fs');
            const fileContent = fs.readFileSync(options.file, 'utf8');
            userData = JSON.parse(fileContent);
          } else {
            // Interactive user creation
            const answers = await inquirer.prompt([
              {
                type: 'input',
                name: 'email',
                message: 'User email address:',
                default: options.email,
                validate: (input) => {
                  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                  return emailRegex.test(input) || 'Please enter a valid email address';
                }
              },
              {
                type: 'input',
                name: 'name',
                message: 'User full name:',
                default: options.name
              },
              {
                type: 'list',
                name: 'role',
                message: 'User role:',
                choices: ['admin', 'user', 'viewer'],
                default: options.role || 'user'
              },
              {
                type: 'confirm',
                name: 'active',
                message: 'Make user active?',
                default: options.active === 'true'
              }
            ]);

            userData = {
              email: answers.email,
              name: answers.name,
              role: answers.role,
              active: answers.active
            };
          }

          const response = await client.raw.users.create(userData);
          const user = response.data || response;

          if (options.json || program.getOptionValue('json')) {
            console.log(JSON.stringify(user, null, 2));
            return;
          }

          console.log(chalk.green('✅ User created successfully!'));
          console.log(`User ID: ${user.id}`);
          console.log(`Email: ${user.email}`);
          if (user.name) {
            console.log(`Name: ${user.name}`);
          }
          console.log(`Role: ${user.role}`);
          console.log(`Status: ${user.active ? chalk.green('Active') : chalk.gray('Inactive')}`);

        } catch (error: any) {
          console.error(chalk.red('Error creating user:'), error.message);
          process.exit(1);
        }
      });

    // users update
    usersCmd
      .command('update <userId>')
      .description('Update an existing user')
      .option('-o, --org <orgId>', 'Organization ID')
      .option('-e, --email <email>', 'New user email address')
      .option('-n, --name <name>', 'New user full name')
      .option('-r, --role <role>', 'New user role (admin, user, viewer)')
      .option('--active <active>', 'Set user active status (true/false)')
      .option('-f, --file <file>', 'Load user definition from JSON file')
      .option('--json', 'Output in JSON format')
      .action(async (userId, options) => {
        try {
          const client = UsersCommand.createClient(program, options);
          let updateData: any = {};

          if (options.file) {
            const fs = await import('fs');
            const fileContent = fs.readFileSync(options.file, 'utf8');
            updateData = JSON.parse(fileContent);
          } else {
            if (options.email) updateData.email = options.email;
            if (options.name) updateData.name = options.name;
            if (options.role) updateData.role = options.role;
            if (options.active !== undefined) {
              updateData.active = options.active === 'true';
            }
          }

          if (Object.keys(updateData).length === 0) {
            console.log(chalk.yellow('No updates specified. Use --email, --name, --role, --active, or --file options.'));
            return;
          }

          const response = await client.raw.users.update(userId, updateData);
          const user = response.data || response;

          if (options.json || program.getOptionValue('json')) {
            console.log(JSON.stringify(user, null, 2));
            return;
          }

          console.log(chalk.green('✅ User updated successfully!'));
          console.log(`User ID: ${user.id}`);
          console.log(`Email: ${user.email}`);
          if (user.name) {
            console.log(`Name: ${user.name}`);
          }
          console.log(`Role: ${user.role}`);
          console.log(`Status: ${user.active ? chalk.green('Active') : chalk.gray('Inactive')}`);

        } catch (error: any) {
          console.error(chalk.red('Error updating user:'), error.message);
          process.exit(1);
        }
      });

    // users delete
    usersCmd
      .command('delete <userId>')
      .description('Delete a user')
      .option('-o, --org <orgId>', 'Organization ID')
      .option('-y, --yes', 'Skip confirmation prompt')
      .action(async (userId, options) => {
        try {
          const client = UsersCommand.createClient(program, options);

          // Get user details for confirmation
          const user = await client.raw.users.retrieve(userId);
          const userData = user.data || user;

          if (!options.yes) {
            const { confirm } = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'confirm',
                message: `Delete user "${userData.name || userData.email}" (${userId})?`,
                default: false
              }
            ]);

            if (!confirm) {
              console.log('Delete cancelled.');
              return;
            }
          }

          await client.raw.users.delete(userId);
          console.log(chalk.green(`✅ User "${userData.name || userData.email}" deleted successfully.`));

        } catch (error: any) {
          console.error(chalk.red('Error deleting user:'), error.message);
          process.exit(1);
        }
      });

    // users me
    usersCmd
      .command('me')
      .description('Get information about the current user')
      .option('-o, --org <orgId>', 'Organization ID')
      .option('--json', 'Output in JSON format')
      .action(async (options) => {
        try {
          const client = UsersCommand.createClient(program, options);
          
          // Try to get current user info (this might need to be adapted based on your API)
          // For now, we'll use a generic approach
          const response = await client.raw.users.list({ limit: 1, current: true });
          let user = response.data?.[0] || response[0];

          if (!user) {
            console.log(chalk.yellow('Unable to determine current user. Make sure you are authenticated.'));
            return;
          }

          if (options.json || program.getOptionValue('json')) {
            console.log(JSON.stringify(user, null, 2));
            return;
          }

          console.log(chalk.bold.blue(`\n👤 Current User\n`));
          console.log(`ID: ${user.id}`);
          
          if (user.email) {
            console.log(`Email: ${user.email}`);
          }
          
          if (user.name) {
            console.log(`Name: ${user.name}`);
          }
          
          if (user.role) {
            console.log(`Role: ${user.role}`);
          }
          
          const status = user.active !== false 
            ? chalk.green('Active') 
            : chalk.gray('Inactive');
          console.log(`Status: ${status}`);
          
          console.log(`Created: ${new Date(user.createdAt).toLocaleDateString()}`);
          
          if (user.lastActiveAt) {
            console.log(`Last Active: ${new Date(user.lastActiveAt).toLocaleString()}`);
          }

        } catch (error: any) {
          console.error(chalk.red('Error getting current user info:'), error.message);
          console.log(chalk.yellow('Make sure you are properly authenticated with a valid API key.'));
          process.exit(1);
        }
      });
  }

  private static createClient(program: Command, options: UserCommandOptions): TolstoyClient {
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