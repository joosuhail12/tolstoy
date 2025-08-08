import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface TolstoyConfig {
  profiles: Record<string, ProfileConfig>;
  currentProfile: string;
  version: string;
}

export interface ProfileConfig {
  name: string;
  apiUrl: string;
  apiKey: string;
  orgId?: string;
  userId?: string;
  default?: boolean;
  description?: string;
}

export class ConfigCommand {
  private static readonly CONFIG_DIR = path.join(os.homedir(), '.tolstoy');
  private static readonly CONFIG_FILE = path.join(ConfigCommand.CONFIG_DIR, 'config.json');
  private static readonly DEFAULT_CONFIG: TolstoyConfig = {
    profiles: {},
    currentProfile: 'default',
    version: '1.0.0'
  };

  static register(program: Command): void {
    const configCmd = program
      .command('config')
      .description('Manage CLI configuration and profiles');

    // config list
    configCmd
      .command('list')
      .description('List all configuration profiles')
      .option('--json', 'Output in JSON format')
      .action(async (options) => {
        try {
          const config = ConfigCommand.loadConfig();

          if (options.json) {
            console.log(JSON.stringify(config, null, 2));
            return;
          }

          const profiles = Object.values(config.profiles);
          if (profiles.length === 0) {
            console.log(chalk.yellow('No profiles configured.'));
            console.log(`Run ${chalk.cyan('tolstoy config add')} to create your first profile.`);
            return;
          }

          console.log(chalk.bold.blue(`\n⚙️  Configuration Profiles (${profiles.length})\n`));
          
          profiles.forEach((profile: ProfileConfig) => {
            const isCurrent = profile.name === config.currentProfile;
            const marker = isCurrent ? chalk.green('●') : chalk.gray('○');
            const nameColor = isCurrent ? chalk.green : chalk.white;
            
            console.log(`${marker} ${nameColor(profile.name)}${isCurrent ? chalk.dim(' (current)') : ''}`);
            console.log(`   API URL: ${profile.apiUrl}`);
            console.log(`   API Key: ${profile.apiKey ? chalk.green('✓ configured') : chalk.red('✗ missing')}`);
            
            if (profile.orgId) {
              console.log(`   Org ID: ${profile.orgId}`);
            }
            
            if (profile.userId) {
              console.log(`   User ID: ${profile.userId}`);
            }
            
            if (profile.description) {
              console.log(`   Description: ${profile.description}`);
            }
            
            console.log();
          });

          console.log(chalk.dim(`Current profile: ${config.currentProfile}`));
          console.log(chalk.dim(`Config file: ${ConfigCommand.CONFIG_FILE}`));

        } catch (error: any) {
          console.error(chalk.red('Error listing config:'), error.message);
          process.exit(1);
        }
      });

    // config get
    configCmd
      .command('get [key]')
      .description('Get configuration value(s)')
      .option('-p, --profile <profile>', 'Profile name')
      .option('--json', 'Output in JSON format')
      .action(async (key, options) => {
        try {
          const config = ConfigCommand.loadConfig();
          const profileName = options.profile || config.currentProfile;
          const profile = config.profiles[profileName];

          if (!profile) {
            console.error(chalk.red(`Profile "${profileName}" not found.`));
            process.exit(1);
          }

          if (key) {
            const value = (profile as any)[key];
            if (value === undefined) {
              console.error(chalk.red(`Configuration key "${key}" not found.`));
              process.exit(1);
            }

            if (options.json) {
              console.log(JSON.stringify({ [key]: value }, null, 2));
            } else {
              // Hide sensitive values in non-JSON output
              const displayValue = key === 'apiKey' ? '[HIDDEN]' : value;
              console.log(displayValue);
            }
          } else {
            if (options.json) {
              console.log(JSON.stringify(profile, null, 2));
            } else {
              console.log(chalk.bold.blue(`\n⚙️  Profile: ${profile.name}\n`));
              console.log(`API URL: ${profile.apiUrl}`);
              console.log(`API Key: ${profile.apiKey ? chalk.green('[CONFIGURED]') : chalk.red('[MISSING]')}`);
              if (profile.orgId) console.log(`Org ID: ${profile.orgId}`);
              if (profile.userId) console.log(`User ID: ${profile.userId}`);
              if (profile.description) console.log(`Description: ${profile.description}`);
            }
          }

        } catch (error: any) {
          console.error(chalk.red('Error getting config:'), error.message);
          process.exit(1);
        }
      });

    // config set
    configCmd
      .command('set <key> <value>')
      .description('Set a configuration value')
      .option('-p, --profile <profile>', 'Profile name (defaults to current)')
      .action(async (key, value, options) => {
        try {
          const config = ConfigCommand.loadConfig();
          const profileName = options.profile || config.currentProfile;
          
          if (!config.profiles[profileName]) {
            console.error(chalk.red(`Profile "${profileName}" not found.`));
            process.exit(1);
          }

          const validKeys = ['apiUrl', 'apiKey', 'orgId', 'userId', 'description'];
          if (!validKeys.includes(key)) {
            console.error(chalk.red(`Invalid configuration key "${key}".`));
            console.log(`Valid keys: ${validKeys.join(', ')}`);
            process.exit(1);
          }

          (config.profiles[profileName] as any)[key] = value;
          ConfigCommand.saveConfig(config);

          console.log(chalk.green(`✅ Set ${key} for profile "${profileName}"`));
          
          if (key === 'apiKey') {
            console.log(`${chalk.dim('Value:')} [HIDDEN]`);
          } else {
            console.log(`${chalk.dim('Value:')} ${value}`);
          }

        } catch (error: any) {
          console.error(chalk.red('Error setting config:'), error.message);
          process.exit(1);
        }
      });

    // config add (create new profile)
    configCmd
      .command('add [name]')
      .description('Add a new configuration profile')
      .option('--api-url <url>', 'API base URL')
      .option('--api-key <key>', 'API key')
      .option('--org-id <orgId>', 'Organization ID')
      .option('--user-id <userId>', 'User ID')
      .option('--description <description>', 'Profile description')
      .option('--make-current', 'Set as current profile')
      .action(async (name, options) => {
        try {
          const config = ConfigCommand.loadConfig();
          
          const profileName = name || await ConfigCommand.promptForName(config);
          
          if (config.profiles[profileName]) {
            const { overwrite } = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'overwrite',
                message: `Profile "${profileName}" already exists. Overwrite?`,
                default: false
              }
            ]);
            
            if (!overwrite) {
              console.log('Profile creation cancelled.');
              return;
            }
          }

          let profileConfig: Partial<ProfileConfig>;

          if (options.apiUrl && options.apiKey) {
            // Non-interactive mode
            profileConfig = {
              name: profileName,
              apiUrl: options.apiUrl,
              apiKey: options.apiKey,
              orgId: options.orgId,
              userId: options.userId,
              description: options.description
            };
          } else {
            // Interactive mode
            profileConfig = await ConfigCommand.promptForProfile(profileName, options);
          }

          config.profiles[profileName] = profileConfig as ProfileConfig;
          
          if (options.makeCurrent || Object.keys(config.profiles).length === 1) {
            config.currentProfile = profileName;
          }

          ConfigCommand.saveConfig(config);

          console.log(chalk.green(`✅ Profile "${profileName}" created successfully!`));
          
          if (config.currentProfile === profileName) {
            console.log(chalk.blue(`Set as current profile.`));
          }

          // Test the configuration
          const { test } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'test',
              message: 'Test the connection now?',
              default: true
            }
          ]);

          if (test) {
            await ConfigCommand.testConnection(profileConfig as ProfileConfig);
          }

        } catch (error: any) {
          console.error(chalk.red('Error adding profile:'), error.message);
          process.exit(1);
        }
      });

    // config remove
    configCmd
      .command('remove <name>')
      .description('Remove a configuration profile')
      .option('-y, --yes', 'Skip confirmation prompt')
      .action(async (name, options) => {
        try {
          const config = ConfigCommand.loadConfig();
          
          if (!config.profiles[name]) {
            console.error(chalk.red(`Profile "${name}" not found.`));
            process.exit(1);
          }

          if (!options.yes) {
            const { confirm } = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'confirm',
                message: `Remove profile "${name}"?`,
                default: false
              }
            ]);

            if (!confirm) {
              console.log('Profile removal cancelled.');
              return;
            }
          }

          delete config.profiles[name];

          // If this was the current profile, switch to another one
          if (config.currentProfile === name) {
            const remainingProfiles = Object.keys(config.profiles);
            if (remainingProfiles.length > 0) {
              config.currentProfile = remainingProfiles[0];
              console.log(chalk.yellow(`Switched current profile to "${config.currentProfile}".`));
            } else {
              config.currentProfile = 'default';
            }
          }

          ConfigCommand.saveConfig(config);
          console.log(chalk.green(`✅ Profile "${name}" removed.`));

        } catch (error: any) {
          console.error(chalk.red('Error removing profile:'), error.message);
          process.exit(1);
        }
      });

    // config use (switch profile)
    configCmd
      .command('use <name>')
      .description('Switch to a different profile')
      .action(async (name, options) => {
        try {
          const config = ConfigCommand.loadConfig();
          
          if (!config.profiles[name]) {
            console.error(chalk.red(`Profile "${name}" not found.`));
            process.exit(1);
          }

          config.currentProfile = name;
          ConfigCommand.saveConfig(config);

          console.log(chalk.green(`✅ Switched to profile "${name}".`));

          // Show the profile details
          const profile = config.profiles[name];
          console.log(chalk.dim(`API URL: ${profile.apiUrl}`));
          if (profile.orgId) console.log(chalk.dim(`Org ID: ${profile.orgId}`));

        } catch (error: any) {
          console.error(chalk.red('Error switching profile:'), error.message);
          process.exit(1);
        }
      });

    // config test
    configCmd
      .command('test [profile]')
      .description('Test connection with a profile')
      .action(async (profileName, options) => {
        try {
          const config = ConfigCommand.loadConfig();
          const targetProfile = profileName || config.currentProfile;
          const profile = config.profiles[targetProfile];

          if (!profile) {
            console.error(chalk.red(`Profile "${targetProfile}" not found.`));
            process.exit(1);
          }

          await ConfigCommand.testConnection(profile);

        } catch (error: any) {
          console.error(chalk.red('Error testing connection:'), error.message);
          process.exit(1);
        }
      });

    // config export
    configCmd
      .command('export [file]')
      .description('Export configuration to a file')
      .option('--exclude-secrets', 'Exclude API keys from export')
      .action(async (file, options) => {
        try {
          const config = ConfigCommand.loadConfig();
          let exportConfig = { ...config };

          if (options.excludeSecrets) {
            exportConfig.profiles = Object.fromEntries(
              Object.entries(config.profiles).map(([name, profile]) => [
                name,
                { ...profile, apiKey: '' }
              ])
            );
          }

          const exportData = JSON.stringify(exportConfig, null, 2);
          const outputFile = file || 'tolstoy-config.json';

          fs.writeFileSync(outputFile, exportData);
          console.log(chalk.green(`✅ Configuration exported to ${outputFile}`));

          if (options.excludeSecrets) {
            console.log(chalk.yellow('⚠️  API keys excluded from export.'));
          }

        } catch (error: any) {
          console.error(chalk.red('Error exporting config:'), error.message);
          process.exit(1);
        }
      });

    // config import
    configCmd
      .command('import <file>')
      .description('Import configuration from a file')
      .option('--merge', 'Merge with existing config instead of replacing')
      .action(async (file, options) => {
        try {
          if (!fs.existsSync(file)) {
            console.error(chalk.red(`File "${file}" not found.`));
            process.exit(1);
          }

          const importData = JSON.parse(fs.readFileSync(file, 'utf8'));
          let config = options.merge ? ConfigCommand.loadConfig() : ConfigCommand.DEFAULT_CONFIG;

          // Merge profiles
          Object.assign(config.profiles, importData.profiles);
          
          if (importData.currentProfile && config.profiles[importData.currentProfile]) {
            config.currentProfile = importData.currentProfile;
          }

          ConfigCommand.saveConfig(config);
          
          const profileCount = Object.keys(importData.profiles).length;
          console.log(chalk.green(`✅ Imported ${profileCount} profiles from ${file}`));

        } catch (error: any) {
          console.error(chalk.red('Error importing config:'), error.message);
          process.exit(1);
        }
      });
  }

  // Helper methods
  private static loadConfig(): TolstoyConfig {
    try {
      if (!fs.existsSync(ConfigCommand.CONFIG_FILE)) {
        return { ...ConfigCommand.DEFAULT_CONFIG };
      }

      const configData = fs.readFileSync(ConfigCommand.CONFIG_FILE, 'utf8');
      const config = JSON.parse(configData);
      
      // Ensure config has required structure
      return {
        ...ConfigCommand.DEFAULT_CONFIG,
        ...config,
        profiles: config.profiles || {}
      };
    } catch (error) {
      console.error(chalk.yellow('Warning: Could not load config file. Using defaults.'));
      return { ...ConfigCommand.DEFAULT_CONFIG };
    }
  }

  private static saveConfig(config: TolstoyConfig): void {
    try {
      // Ensure config directory exists
      if (!fs.existsSync(ConfigCommand.CONFIG_DIR)) {
        fs.mkdirSync(ConfigCommand.CONFIG_DIR, { recursive: true });
      }

      fs.writeFileSync(
        ConfigCommand.CONFIG_FILE,
        JSON.stringify(config, null, 2)
      );
    } catch (error: any) {
      throw new Error(`Failed to save config: ${error.message}`);
    }
  }

  private static async promptForName(config: TolstoyConfig): Promise<string> {
    const existingProfiles = Object.keys(config.profiles);
    
    const { name } = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Profile name:',
        default: 'default',
        validate: (input: string) => {
          if (!input.trim()) return 'Profile name is required';
          if (!/^[a-zA-Z0-9_-]+$/.test(input)) {
            return 'Profile name can only contain letters, numbers, underscores, and hyphens';
          }
          return true;
        }
      }
    ]);

    return name.trim();
  }

  private static async promptForProfile(name: string, options: any): Promise<Partial<ProfileConfig>> {
    const questions = [
      {
        type: 'input',
        name: 'apiUrl',
        message: 'API Base URL:',
        default: options.apiUrl || 'https://api.tolstoy.dev',
        validate: (input: string) => {
          try {
            new URL(input);
            return true;
          } catch {
            return 'Please enter a valid URL';
          }
        }
      },
      {
        type: 'password',
        name: 'apiKey',
        message: 'API Key:',
        mask: '*',
        validate: (input: string) => {
          return input.length > 0 || 'API key is required';
        }
      },
      {
        type: 'input',
        name: 'orgId',
        message: 'Organization ID (optional):',
        default: options.orgId
      },
      {
        type: 'input',
        name: 'userId',
        message: 'User ID (optional):',
        default: options.userId
      },
      {
        type: 'input',
        name: 'description',
        message: 'Profile description (optional):',
        default: options.description
      }
    ];

    const answers = await inquirer.prompt(questions);
    
    return {
      name,
      apiUrl: answers.apiUrl,
      apiKey: answers.apiKey,
      orgId: answers.orgId || undefined,
      userId: answers.userId || undefined,
      description: answers.description || undefined
    };
  }

  private static async testConnection(profile: ProfileConfig): Promise<void> {
    try {
      console.log(chalk.blue(`🧪 Testing connection to ${profile.apiUrl}...`));
      
      // Import here to avoid circular dependencies
      const { TolstoyClient } = await import('../client');
      
      const client = new TolstoyClient({
        baseURL: profile.apiUrl,
        orgId: profile.orgId,
        token: profile.apiKey
      });

      // Try to make a simple API call
      await client.raw.health.check();
      
      console.log(chalk.green('✅ Connection successful!'));
      
    } catch (error: any) {
      console.log(chalk.red('❌ Connection failed:'));
      console.log(chalk.red(`   ${error.message}`));
      
      if (error.code === 'ECONNREFUSED') {
        console.log(chalk.yellow('Hint: Check if the API URL is correct and accessible'));
      } else if (error.message.includes('401') || error.message.includes('403')) {
        console.log(chalk.yellow('Hint: Check if your API key is valid'));
      }
    }
  }

  // Public method to get current profile for other commands
  static getCurrentProfile(): ProfileConfig | null {
    try {
      const config = ConfigCommand.loadConfig();
      return config.profiles[config.currentProfile] || null;
    } catch {
      return null;
    }
  }

  static getProfile(name: string): ProfileConfig | null {
    try {
      const config = ConfigCommand.loadConfig();
      return config.profiles[name] || null;
    } catch {
      return null;
    }
  }
}