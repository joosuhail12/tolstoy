import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import * as fs from 'fs';
import * as path from 'path';
import { TolstoyClient } from '../client';
import { ConfigCommand } from './config';

export interface InitOptions {
  name?: string;
  template?: string;
  profile?: string;
  skipGit?: boolean;
  skipInstall?: boolean;
  force?: boolean;
}

export interface ProjectConfig {
  name: string;
  description?: string;
  tolstoyConfig: {
    profile: string;
    orgId: string;
    templates: string[];
  };
  version: string;
}

export class InitCommand {
  private static readonly PROJECT_CONFIG_FILE = 'tolstoy.json';
  private static readonly GITIGNORE_CONTENT = `# Dependencies
node_modules/
.npm
.yarn

# Environment files
.env
.env.local
.env.*.local

# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~

# OS files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Tolstoy CLI
.tolstoy/local-cache
*.tolstoy.bak
`;

  private static readonly README_TEMPLATE = `# {{PROJECT_NAME}}

{{DESCRIPTION}}

## Getting Started

This project uses the Tolstoy workflow automation platform. 

### Prerequisites

- [Tolstoy CLI](https://docs.tolstoy.dev/cli) installed
- Access to a Tolstoy organization

### Setup

1. Configure your Tolstoy CLI profile:
   \`\`\`bash
   tolstoy config add
   \`\`\`

2. Set the project profile:
   \`\`\`bash
   tolstoy config use {{PROFILE_NAME}}
   \`\`\`

3. List available flows:
   \`\`\`bash
   tolstoy flows list
   \`\`\`

### Project Structure

- \`tolstoy.json\` - Project configuration
- \`flows/\` - Custom flow definitions
- \`actions/\` - Custom action definitions
- \`templates/\` - Workflow templates

### Common Commands

\`\`\`bash
# List flows
tolstoy flows list

# Execute a flow
tolstoy flows execute <flowId> '{"key": "value"}'

# View logs
tolstoy logs list

# Check system status
tolstoy status
\`\`\`

## Documentation

- [Tolstoy Documentation](https://docs.tolstoy.dev)
- [CLI Reference](https://docs.tolstoy.dev/cli)
- [API Reference](https://docs.tolstoy.dev/api)

## Support

- [GitHub Issues](https://github.com/tolstoy-dev/cli/issues)
- [Community Discord](https://discord.gg/tolstoy)
`;

  static register(program: Command): void {
    program
      .command('init [project-name]')
      .description('Initialize a new Tolstoy project')
      .option('-t, --template <template>', 'Use a specific project template')
      .option('-p, --profile <profile>', 'Use a specific CLI profile')
      .option('--skip-git', 'Skip git repository initialization')
      .option('--skip-install', 'Skip dependency installation')
      .option('--force', 'Overwrite existing files')
      .action(async (projectName, options: InitOptions) => {
        try {
          const currentDir = process.cwd();
          let projectPath = currentDir;
          let actualProjectName = projectName;

          // Determine project name and path
          if (projectName) {
            projectPath = path.join(currentDir, projectName);
            actualProjectName = projectName;
          } else {
            actualProjectName = path.basename(currentDir);
          }

          console.log(chalk.bold.blue('🚀 Welcome to Tolstoy Project Initialization\n'));

          // Check if directory exists and has content
          if (projectName && fs.existsSync(projectPath)) {
            if (!options.force && fs.readdirSync(projectPath).length > 0) {
              const { overwrite } = await inquirer.prompt([
                {
                  type: 'confirm',
                  name: 'overwrite',
                  message: `Directory "${projectName}" is not empty. Continue anyway?`,
                  default: false
                }
              ]);

              if (!overwrite) {
                console.log('Initialization cancelled.');
                return;
              }
            }
          }

          // Create project directory if needed
          if (projectName && !fs.existsSync(projectPath)) {
            fs.mkdirSync(projectPath, { recursive: true });
          }

          // Check for existing project config
          const configPath = path.join(projectPath, InitCommand.PROJECT_CONFIG_FILE);
          if (fs.existsSync(configPath) && !options.force) {
            const { overwrite } = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'overwrite',
                message: 'Tolstoy project already exists. Overwrite configuration?',
                default: false
              }
            ]);

            if (!overwrite) {
              console.log('Initialization cancelled.');
              return;
            }
          }

          // Interactive project setup
          const projectConfig = await InitCommand.promptForProjectConfig(
            actualProjectName,
            options
          );

          // Create project structure
          await InitCommand.createProjectStructure(projectPath, projectConfig, options);

          // Initialize git if requested
          if (!options.skipGit) {
            await InitCommand.initializeGit(projectPath);
          }

          console.log(chalk.green('\n✅ Project initialized successfully!'));
          console.log(chalk.bold.blue('\n📋 Next Steps:'));
          
          if (projectName) {
            console.log(`   1. ${chalk.cyan(`cd ${projectName}`)}`);
          }
          
          console.log(`   2. ${chalk.cyan('tolstoy config list')} - View available profiles`);
          console.log(`   3. ${chalk.cyan('tolstoy flows list')} - List available flows`);
          console.log(`   4. ${chalk.cyan('tolstoy templates list')} - Browse templates`);
          
          if (!options.skipGit) {
            console.log(`   5. ${chalk.cyan('git add .')} && ${chalk.cyan('git commit -m "Initial commit"')}`);
          }

          console.log(chalk.dim(`\n📁 Project created at: ${projectPath}`));

        } catch (error: any) {
          console.error(chalk.red('Error initializing project:'), error.message);
          process.exit(1);
        }
      });
  }

  private static async promptForProjectConfig(
    defaultName: string,
    options: InitOptions
  ): Promise<ProjectConfig> {
    // Get available profiles
    const profiles = InitCommand.getAvailableProfiles();
    let selectedProfile = options.profile;

    const questions: any[] = [
      {
        type: 'input',
        name: 'name',
        message: 'Project name:',
        default: defaultName,
        validate: (input: string) => {
          return input.length > 0 || 'Project name is required';
        }
      },
      {
        type: 'input',
        name: 'description',
        message: 'Project description (optional):'
      }
    ];

    // Profile selection
    if (profiles.length === 0) {
      console.log(chalk.yellow('⚠️  No CLI profiles found.'));
      const { createProfile } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'createProfile',
          message: 'Create a new profile now?',
          default: true
        }
      ]);

      if (createProfile) {
        console.log(chalk.blue('\n🔧 Creating new CLI profile...'));
        // This would need to call the config add command
        console.log(`Run ${chalk.cyan('tolstoy config add')} to create a profile first.`);
        process.exit(1);
      } else {
        selectedProfile = 'default';
      }
    } else if (!selectedProfile) {
      questions.push({
        type: 'list',
        name: 'profile',
        message: 'Select CLI profile to use:',
        choices: profiles.map(p => ({
          name: `${p.name} (${p.apiUrl})`,
          value: p.name
        }))
      });
    }

    // Template selection
    if (!options.template) {
      questions.push({
        type: 'list',
        name: 'template',
        message: 'Select project template:',
        choices: [
          { name: 'Empty Project (start from scratch)', value: 'empty' },
          { name: 'Basic Workflow (simple example)', value: 'basic' },
          { name: 'API Integration (REST API calls)', value: 'api' },
          { name: 'Data Processing (ETL pipeline)', value: 'etl' },
          { name: 'Notifications (alerts and messaging)', value: 'notifications' }
        ]
      });
    }

    const answers = await inquirer.prompt(questions);

    // Get organization ID from selected profile
    const profile = ConfigCommand.getProfile(selectedProfile || answers.profile);
    let orgId = profile?.orgId;

    if (!orgId) {
      console.log(chalk.yellow('⚠️  No organization ID in profile. Attempting to fetch...'));
      try {
        if (profile) {
          const client = new TolstoyClient({
            baseURL: profile.apiUrl,
            token: profile.apiKey,
            orgId: profile.orgId
          });
          
          const orgsResponse = await client.raw.organizations.list();
          const orgs = orgsResponse.data || orgsResponse;
          
          if (orgs.length > 0) {
            if (orgs.length === 1) {
              orgId = orgs[0].id;
            } else {
              const { selectedOrg } = await inquirer.prompt([
                {
                  type: 'list',
                  name: 'selectedOrg',
                  message: 'Select organization:',
                  choices: orgs.map((org: any) => ({
                    name: `${org.name} (${org.id})`,
                    value: org.id
                  }))
                }
              ]);
              orgId = selectedOrg;
            }
          }
        }
      } catch (error) {
        console.log(chalk.yellow('Could not fetch organizations. You can set this later.'));
        orgId = 'your-org-id';
      }
    }

    return {
      name: answers.name,
      description: answers.description,
      tolstoyConfig: {
        profile: selectedProfile || answers.profile,
        orgId: orgId || 'your-org-id',
        templates: []
      },
      version: '1.0.0'
    };
  }

  private static async createProjectStructure(
    projectPath: string,
    config: ProjectConfig,
    options: InitOptions
  ): Promise<void> {
    console.log(chalk.blue('📁 Creating project structure...'));

    // Create directories
    const directories = [
      'flows',
      'actions', 
      'templates',
      'scripts'
    ];

    directories.forEach(dir => {
      const dirPath = path.join(projectPath, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    });

    // Create tolstoy.json
    const configPath = path.join(projectPath, InitCommand.PROJECT_CONFIG_FILE);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    // Create README.md
    const readmePath = path.join(projectPath, 'README.md');
    const readmeContent = InitCommand.README_TEMPLATE
      .replace(/{{PROJECT_NAME}}/g, config.name)
      .replace(/{{DESCRIPTION}}/g, config.description || `A Tolstoy workflow automation project.`)
      .replace(/{{PROFILE_NAME}}/g, config.tolstoyConfig.profile);
    
    fs.writeFileSync(readmePath, readmeContent);

    // Create .gitignore
    if (!options.skipGit) {
      const gitignorePath = path.join(projectPath, '.gitignore');
      fs.writeFileSync(gitignorePath, InitCommand.GITIGNORE_CONTENT);
    }

    // Create example files based on template
    await InitCommand.createTemplateFiles(projectPath, options.template || 'empty', config);

    console.log(chalk.green('   ✓ Project structure created'));
  }

  private static async createTemplateFiles(
    projectPath: string,
    template: string,
    config: ProjectConfig
  ): Promise<void> {
    const templatesDir = path.join(projectPath, 'templates');

    switch (template) {
      case 'basic':
        // Create a simple workflow template
        const basicFlow = {
          name: 'Hello World Flow',
          description: 'A simple example flow',
          version: 1,
          triggers: [{
            type: 'manual',
            config: {}
          }],
          steps: [{
            id: 'step_1',
            name: 'Log Message',
            type: 'action',
            actionId: 'log_message',
            config: {
              message: 'Hello from Tolstoy!'
            }
          }],
          settings: {
            timeout: 30000
          }
        };
        
        fs.writeFileSync(
          path.join(templatesDir, 'hello-world.json'),
          JSON.stringify(basicFlow, null, 2)
        );
        break;

      case 'api':
        // Create API integration example
        const apiFlow = {
          name: 'API Integration Flow',
          description: 'Example of calling external APIs',
          version: 1,
          steps: [{
            id: 'fetch_data',
            name: 'Fetch User Data',
            type: 'action',
            actionId: 'http_request',
            config: {
              method: 'GET',
              url: 'https://jsonplaceholder.typicode.com/users/1',
              headers: {
                'Content-Type': 'application/json'
              }
            }
          }]
        };
        
        fs.writeFileSync(
          path.join(templatesDir, 'api-integration.json'),
          JSON.stringify(apiFlow, null, 2)
        );
        break;

      case 'etl':
        // Create ETL pipeline example
        const etlFlow = {
          name: 'Data Processing Pipeline',
          description: 'Extract, transform, and load data',
          version: 1,
          steps: [
            {
              id: 'extract',
              name: 'Extract Data',
              type: 'action',
              actionId: 'data_extract',
              config: {
                source: 'database',
                query: 'SELECT * FROM users WHERE active = true'
              }
            },
            {
              id: 'transform',
              name: 'Transform Data',
              type: 'action',
              actionId: 'data_transform',
              dependencies: ['extract'],
              config: {
                transformations: [
                  { field: 'email', operation: 'lowercase' },
                  { field: 'created_at', operation: 'format', format: 'iso' }
                ]
              }
            },
            {
              id: 'load',
              name: 'Load Data',
              type: 'action',
              actionId: 'data_load',
              dependencies: ['transform'],
              config: {
                destination: 'warehouse',
                table: 'processed_users'
              }
            }
          ]
        };
        
        fs.writeFileSync(
          path.join(templatesDir, 'data-pipeline.json'),
          JSON.stringify(etlFlow, null, 2)
        );
        break;

      case 'notifications':
        // Create notifications example
        const notificationFlow = {
          name: 'Notification System',
          description: 'Send notifications via multiple channels',
          version: 1,
          steps: [{
            id: 'send_slack',
            name: 'Send Slack Notification',
            type: 'action',
            actionId: 'slack_message',
            config: {
              channel: '#alerts',
              message: 'Alert: {{event.message}}',
              username: 'Tolstoy Bot'
            }
          }]
        };
        
        fs.writeFileSync(
          path.join(templatesDir, 'notifications.json'),
          JSON.stringify(notificationFlow, null, 2)
        );
        break;

      default:
        // Empty template - just create placeholder files
        fs.writeFileSync(
          path.join(templatesDir, '.gitkeep'),
          '# Place your workflow templates here\n'
        );
    }

    // Create example scripts
    const scriptsDir = path.join(projectPath, 'scripts');
    const deployScript = `#!/bin/bash
# Deploy workflows to Tolstoy

echo "🚀 Deploying workflows..."

# Import templates
for template in templates/*.json; do
    if [ -f "$template" ]; then
        echo "Importing $template"
        tolstoy templates import "$(basename "$template" .json)" --file "$template"
    fi
done

echo "✅ Deployment complete!"
`;

    fs.writeFileSync(path.join(scriptsDir, 'deploy.sh'), deployScript);
    // Make it executable
    try {
      fs.chmodSync(path.join(scriptsDir, 'deploy.sh'), 0o755);
    } catch (error) {
      // Ignore chmod errors on Windows
    }
  }

  private static async initializeGit(projectPath: string): Promise<void> {
    try {
      const { spawn } = await import('child_process');
      
      console.log(chalk.blue('🔧 Initializing git repository...'));
      
      await new Promise<void>((resolve, reject) => {
        const git = spawn('git', ['init'], { 
          cwd: projectPath,
          stdio: 'pipe'
        });

        git.on('close', (code) => {
          if (code === 0) {
            console.log(chalk.green('   ✓ Git repository initialized'));
            resolve();
          } else {
            reject(new Error(`Git init failed with code ${code}`));
          }
        });

        git.on('error', (error) => {
          if (error.message.includes('ENOENT')) {
            console.log(chalk.yellow('   ⚠️  Git not found, skipping repository initialization'));
            resolve(); // Don't fail the entire process
          } else {
            reject(error);
          }
        });
      });
    } catch (error: any) {
      console.log(chalk.yellow(`   ⚠️  Could not initialize git: ${error.message}`));
    }
  }

  private static getAvailableProfiles(): any[] {
    try {
      // This would need to access the config system
      // For now, return empty array
      const config = ConfigCommand.getCurrentProfile();
      return config ? [config] : [];
    } catch {
      return [];
    }
  }
}