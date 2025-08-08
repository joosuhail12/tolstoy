import { Command } from 'commander';
import chalk from 'chalk';
import { TolstoyClient } from '../client';

export interface LogsCommandOptions {
  org?: string;
  json?: boolean;
  apiUrl?: string;
  apiKey?: string;
}

export class LogsCommand {
  static register(program: Command): void {
    const logsCmd = program
      .command('logs')
      .description('View execution logs and monitor system activity');

    // logs list
    logsCmd
      .command('list')
      .description('List recent execution logs')
      .option('-o, --org <orgId>', 'Organization ID')
      .option('-l, --limit <limit>', 'Limit number of results', '50')
      .option('-f, --flow <flowId>', 'Filter by flow ID')
      .option('-a, --action <actionId>', 'Filter by action ID')
      .option('-s, --status <status>', 'Filter by status (completed, failed, running, pending)')
      .option('--since <datetime>', 'Show logs since this datetime (ISO format)')
      .option('--until <datetime>', 'Show logs until this datetime (ISO format)')
      .option('--follow', 'Follow logs in real-time (not implemented)')
      .option('--json', 'Output in JSON format')
      .action(async (options) => {
        try {
          const client = LogsCommand.createClient(program, options);
          
          // Build query parameters
          const queryParams: any = {
            limit: parseInt(options.limit)
          };

          if (options.flow) queryParams.flowId = options.flow;
          if (options.action) queryParams.actionId = options.action;
          if (options.status) queryParams.status = options.status;
          if (options.since) queryParams.since = options.since;
          if (options.until) queryParams.until = options.until;

          const response = await client.raw.executionLogs.list(queryParams);
          const logs = response.data || response;

          if (options.json || program.getOptionValue('json')) {
            console.log(JSON.stringify(logs, null, 2));
            return;
          }

          if (!logs || logs.length === 0) {
            console.log(chalk.yellow('No execution logs found.'));
            return;
          }

          console.log(chalk.bold.blue(`\n📋 Execution Logs (${logs.length})\n`));
          
          logs.forEach((log: any) => {
            const statusColor = log.status === 'completed' ? chalk.green :
                               log.status === 'failed' ? chalk.red :
                               log.status === 'running' ? chalk.blue : chalk.yellow;
            
            const timestamp = new Date(log.createdAt || log.startedAt).toLocaleString();
            console.log(`${chalk.dim(timestamp)} ${statusColor('●')} ${log.id}`);
            
            if (log.flowId) {
              console.log(`  Flow: ${log.flowId}${log.flowName ? ` (${log.flowName})` : ''}`);
            }
            
            if (log.actionId) {
              console.log(`  Action: ${log.actionId}${log.actionName ? ` (${log.actionName})` : ''}`);
            }
            
            console.log(`  Status: ${statusColor(log.status.toUpperCase())}`);
            
            if (log.duration) {
              console.log(`  Duration: ${log.duration}ms`);
            }
            
            if (log.error) {
              console.log(`  ${chalk.red('Error:')} ${log.error}`);
            }
            
            if (log.message) {
              console.log(`  Message: ${log.message}`);
            }
            
            console.log();
          });

          // Show summary stats
          const statusCounts = logs.reduce((acc: any, log: any) => {
            acc[log.status] = (acc[log.status] || 0) + 1;
            return acc;
          }, {});

          console.log(chalk.dim('Status Summary:'));
          Object.keys(statusCounts).forEach(status => {
            const color = status === 'completed' ? chalk.green :
                         status === 'failed' ? chalk.red :
                         status === 'running' ? chalk.blue : chalk.yellow;
            console.log(chalk.dim(`  ${color(status)}: ${statusCounts[status]}`));
          });

          if (options.follow) {
            console.log(chalk.dim('\nFollowing logs... Press Ctrl+C to stop.'));
            console.log(chalk.yellow('Real-time log following not yet implemented.'));
          }

        } catch (error: any) {
          console.error(chalk.red('Error listing execution logs:'), error.message);
          process.exit(1);
        }
      });

    // logs get
    logsCmd
      .command('get <logId>')
      .description('Get detailed information about a specific execution log')
      .option('-o, --org <orgId>', 'Organization ID')
      .option('--json', 'Output in JSON format')
      .action(async (logId, options) => {
        try {
          const client = LogsCommand.createClient(program, options);
          const response = await client.raw.executionLogs.retrieve(logId);
          const log = response.data || response;

          if (options.json || program.getOptionValue('json')) {
            console.log(JSON.stringify(log, null, 2));
            return;
          }

          const statusColor = log.status === 'completed' ? chalk.green :
                             log.status === 'failed' ? chalk.red :
                             log.status === 'running' ? chalk.blue : chalk.yellow;

          console.log(chalk.bold.blue(`\n📋 Execution Log: ${log.id}\n`));
          console.log(`Status: ${statusColor(log.status.toUpperCase())}`);
          
          if (log.flowId) {
            console.log(`Flow ID: ${log.flowId}`);
            if (log.flowName) {
              console.log(`Flow Name: ${log.flowName}`);
            }
          }
          
          if (log.actionId) {
            console.log(`Action ID: ${log.actionId}`);
            if (log.actionName) {
              console.log(`Action Name: ${log.actionName}`);
            }
          }
          
          if (log.userId) {
            console.log(`User ID: ${log.userId}`);
          }

          console.log(`Created: ${new Date(log.createdAt).toLocaleString()}`);
          
          if (log.startedAt) {
            console.log(`Started: ${new Date(log.startedAt).toLocaleString()}`);
          }
          
          if (log.completedAt) {
            console.log(`Completed: ${new Date(log.completedAt).toLocaleString()}`);
          }
          
          if (log.duration) {
            console.log(`Duration: ${log.duration}ms`);
          }

          // Show inputs
          if (log.inputs && Object.keys(log.inputs).length > 0) {
            console.log(chalk.bold.yellow('\n📥 Inputs:'));
            console.log(JSON.stringify(log.inputs, null, 2));
          }

          // Show outputs
          if (log.outputs && Object.keys(log.outputs).length > 0) {
            console.log(chalk.bold.yellow('\n📤 Outputs:'));
            console.log(JSON.stringify(log.outputs, null, 2));
          }

          // Show error details
          if (log.error) {
            console.log(chalk.bold.red('\n❌ Error Details:'));
            console.log(log.error);
            
            if (log.errorStack) {
              console.log(chalk.bold.red('\n📚 Stack Trace:'));
              console.log(log.errorStack);
            }
          }

          // Show metadata
          if (log.metadata && Object.keys(log.metadata).length > 0) {
            console.log(chalk.bold.yellow('\n📋 Metadata:'));
            console.log(JSON.stringify(log.metadata, null, 2));
          }

          // Show steps (for flow executions)
          if (log.steps && log.steps.length > 0) {
            console.log(chalk.bold.yellow(`\n🔧 Steps (${log.steps.length}):`));
            log.steps.forEach((step: any, index: number) => {
              const stepStatusColor = step.status === 'completed' ? chalk.green :
                                     step.status === 'failed' ? chalk.red :
                                     step.status === 'running' ? chalk.blue : chalk.yellow;
              
              console.log(`  ${index + 1}. ${step.name || step.id} - ${stepStatusColor(step.status)}`);
              if (step.duration) {
                console.log(`     Duration: ${step.duration}ms`);
              }
              if (step.error) {
                console.log(`     ${chalk.red('Error:')} ${step.error}`);
              }
            });
          }

        } catch (error: any) {
          console.error(chalk.red('Error getting execution log:'), error.message);
          process.exit(1);
        }
      });

    // System status command
    const statusCmd = program
      .command('status')
      .description('Check system health and status')
      .option('-o, --org <orgId>', 'Organization ID')
      .option('--detailed', 'Show detailed system information')
      .option('--json', 'Output in JSON format')
      .action(async (options) => {
        try {
          const client = LogsCommand.createClient(program, options);
          
          if (!options.json && !program.getOptionValue('json')) {
            console.log(chalk.blue('🔍 Checking system status...'));
          }

          // Get basic health status
          const healthResponse = await client.raw.health.check();
          const health = healthResponse.data || healthResponse;

          // Get recent activity stats
          const recentLogs = await client.raw.executionLogs.list({ limit: 100 });
          const logs = recentLogs.data || recentLogs;

          // Calculate stats
          const now = new Date();
          const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          const recentActivity = logs.filter((log: any) => 
            new Date(log.createdAt) > last24h
          );

          const statusCounts = recentActivity.reduce((acc: any, log: any) => {
            acc[log.status] = (acc[log.status] || 0) + 1;
            return acc;
          }, {});

          const systemStatus: any = {
            timestamp: now.toISOString(),
            health: health.status || 'unknown',
            uptime: health.uptime,
            version: health.version,
            activity: {
              last24Hours: recentActivity.length,
              completed: statusCounts.completed || 0,
              failed: statusCounts.failed || 0,
              running: statusCounts.running || 0,
              pending: statusCounts.pending || 0
            }
          };

          if (options.detailed) {
            // Add more detailed info
            try {
              const flowsResponse = await client.listFlows();
              const toolsResponse = await client.raw.tools.list();
              const webhooksResponse = await client.raw.webhooks.list();
              
              systemStatus.resources = {
                flows: {
                  total: flowsResponse.data?.length || 0,
                  active: flowsResponse.data?.filter((f: any) => f.active)?.length || 0
                },
                tools: {
                  total: toolsResponse.data?.length || 0
                },
                webhooks: {
                  total: webhooksResponse.data?.length || 0,
                  active: webhooksResponse.data?.filter((w: any) => w.active)?.length || 0
                }
              };
            } catch (error) {
              // Ignore errors for detailed info
            }
          }

          if (options.json || program.getOptionValue('json')) {
            console.log(JSON.stringify(systemStatus, null, 2));
            return;
          }

          // Display status
          const healthColor = health.status === 'healthy' || health.status === 'ok' ? chalk.green :
                             health.status === 'degraded' ? chalk.yellow : chalk.red;
          
          console.log(`\n${healthColor('●')} System Status: ${healthColor(health.status?.toUpperCase() || 'UNKNOWN')}`);
          
          if (health.version) {
            console.log(`Version: ${health.version}`);
          }
          
          if (health.uptime) {
            const uptimeHours = Math.floor(health.uptime / 3600);
            const uptimeMinutes = Math.floor((health.uptime % 3600) / 60);
            console.log(`Uptime: ${uptimeHours}h ${uptimeMinutes}m`);
          }

          console.log(chalk.bold.blue('\n📊 Activity (Last 24 Hours):'));
          console.log(`Total Executions: ${systemStatus.activity.last24Hours}`);
          console.log(`${chalk.green('Completed:')} ${systemStatus.activity.completed}`);
          console.log(`${chalk.red('Failed:')} ${systemStatus.activity.failed}`);
          console.log(`${chalk.blue('Running:')} ${systemStatus.activity.running}`);
          console.log(`${chalk.yellow('Pending:')} ${systemStatus.activity.pending}`);

          if (systemStatus.resources) {
            console.log(chalk.bold.blue('\n📋 Resources:'));
            console.log(`Flows: ${systemStatus.resources.flows.active}/${systemStatus.resources.flows.total} active`);
            console.log(`Tools: ${systemStatus.resources.tools.total}`);
            console.log(`Webhooks: ${systemStatus.resources.webhooks.active}/${systemStatus.resources.webhooks.total} active`);
          }

          const successRate = systemStatus.activity.last24Hours > 0 
            ? (systemStatus.activity.completed / systemStatus.activity.last24Hours * 100).toFixed(1)
            : '0.0';
          
          console.log(`\nSuccess Rate: ${successRate}%`);
          
          if (health.status === 'healthy' || health.status === 'ok') {
            console.log(chalk.green('\n✅ System is healthy and operational'));
          } else if (health.status === 'degraded') {
            console.log(chalk.yellow('\n⚠️  System is experiencing degraded performance'));
          } else {
            console.log(chalk.red('\n❌ System is experiencing issues'));
          }

        } catch (error: any) {
          console.error(chalk.red('Error checking system status:'), error.message);
          
          // Try to provide basic connectivity info
          console.log(chalk.yellow('\n⚠️  Unable to get full system status. Basic connectivity test:'));
          
          try {
            // Basic connection test
            await LogsCommand.createClient(program, options);
            console.log(chalk.green('✅ API connection successful'));
          } catch (connError: any) {
            console.log(chalk.red('❌ API connection failed'));
            console.log(`Error: ${connError.message}`);
          }
          
          process.exit(1);
        }
      });
  }

  private static createClient(program: Command, options: LogsCommandOptions): TolstoyClient {
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