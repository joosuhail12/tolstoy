import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Daytona } from '@daytonaio/sdk';
import { AwsSecretsService } from '../aws-secrets.service';

export interface HttpExecutionRequest {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers: Record<string, string>;
  body?: string;
  timeout?: number;
}

export interface DaytonaConfig {
  apiKey: string;
  apiUrl: string;
  target: string;
  syncTimeout: number;
  asyncTimeout: number;
}

export interface HttpExecutionResponse {
  success: boolean;
  statusCode: number;
  headers: Record<string, string>;
  data: unknown;
  duration: number;
  executionId: string;
  executedInSandbox: boolean;
  sandboxId?: string;
  error?: {
    message: string;
    code?: string;
    type: 'network' | 'timeout' | 'sandbox' | 'execution';
  };
}

@Injectable()
export class DaytonaService implements OnModuleDestroy {
  private daytona: Daytona | null = null;
  private isInitialized = false;
  private activeSandboxes = new Map<string, any>();
  private config: DaytonaConfig | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly awsSecretsService: AwsSecretsService,
    @InjectPinoLogger(DaytonaService.name)
    private readonly logger: PinoLogger,
  ) {
    this.initializeDaytona();
  }

  private async initializeDaytona(): Promise<void> {
    try {
      this.logger.info('Initializing Daytona SDK...');

      // Try to get Daytona credentials from AWS Secrets Manager first
      let apiKey: string | undefined;
      let apiUrl: string | undefined;
      let target: string | undefined;

      try {
        apiKey = await this.awsSecretsService.getDaytonaApiKey();
        // Try to get other Daytona config from secrets
        try {
          apiUrl = await this.awsSecretsService.getDaytonaBaseUrl();
        } catch {
          apiUrl = this.configService.get<string>('DAYTONA_API_URL', 'https://api.daytona.io');
        }
        try {
          target = await this.awsSecretsService.getSecret('tolstoy/env', 'DAYTONA_TARGET');
        } catch {
          target = this.configService.get<string>('DAYTONA_TARGET', 'us');
          this.logger.debug('DAYTONA_TARGET not found in secrets, using default: us');
        }

        // Get timeout configuration
        let syncTimeout: number;
        let asyncTimeout: number;
        try {
          syncTimeout = parseInt(await this.awsSecretsService.getDaytonaSyncTimeout()) || 30000;
          asyncTimeout = parseInt(await this.awsSecretsService.getDaytonaAsyncTimeout()) || 60000;
        } catch {
          syncTimeout = parseInt(this.configService.get<string>('DAYTONA_SYNC_TIMEOUT', '30000'));
          asyncTimeout = parseInt(this.configService.get<string>('DAYTONA_ASYNC_TIMEOUT', '60000'));
        }

        this.config = {
          apiKey,
          apiUrl,
          target,
          syncTimeout,
          asyncTimeout,
        };

        this.logger.info(
          'Retrieved Daytona credentials and configuration from AWS Secrets Manager',
        );
      } catch {
        // Fallback to environment variables
        apiKey = this.configService.get<string>('DAYTONA_API_KEY');
        apiUrl = this.configService.get<string>('DAYTONA_API_URL', 'https://api.daytona.io');
        target = this.configService.get<string>('DAYTONA_TARGET', 'us');

        const syncTimeout = parseInt(
          this.configService.get<string>('DAYTONA_SYNC_TIMEOUT', '30000'),
        );
        const asyncTimeout = parseInt(
          this.configService.get<string>('DAYTONA_ASYNC_TIMEOUT', '60000'),
        );

        this.config = {
          apiKey: apiKey || '',
          apiUrl,
          target,
          syncTimeout,
          asyncTimeout,
        };

        this.logger.info('Using Daytona credentials from environment variables');
      }

      if (!apiKey) {
        this.logger.warn(
          'DAYTONA_API_KEY not found - HTTP execution will fallback to direct calls',
        );
        return;
      }

      this.daytona = new Daytona({
        apiKey,
        apiUrl,
        target,
      });

      this.isInitialized = true;
      this.logger.info('Daytona SDK initialized successfully');
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'Failed to initialize Daytona SDK',
      );
      this.daytona = null;
    }
  }

  async executeHttpRequest(request: HttpExecutionRequest): Promise<HttpExecutionResponse> {
    const executionId = `http_exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    const timeout = request.timeout || this.config?.syncTimeout || 30000; // Use configured timeout

    this.logger.info(
      {
        executionId,
        method: request.method,
        url: request.url,
        timeout,
      },
      'Starting HTTP execution in Daytona sandbox',
    );

    if (!this.isInitialized || !this.daytona) {
      this.logger.warn('Daytona not available, falling back to direct HTTP execution');
      return this.executeDirectHttp(request, executionId, startTime);
    }

    let sandbox: any = null;
    let sandboxId: string | undefined = undefined;

    try {
      // Create sandbox with timeout handling
      this.logger.info({ executionId }, 'Creating Daytona sandbox for HTTP execution');
      const sandboxPromise = this.getOrCreateSandbox(executionId);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Sandbox creation timeout')), 15000);
      });

      sandbox = await Promise.race([sandboxPromise, timeoutPromise]);
      sandboxId = sandbox.id || executionId;

      // Track active sandbox
      this.activeSandboxes.set(executionId, {
        sandbox,
        sandboxId,
        createdAt: new Date(),
        executionId,
      });

      this.logger.info(
        {
          executionId,
          sandboxId,
          activeSandboxes: this.activeSandboxes.size,
          sandboxMethods: Object.getOwnPropertyNames(sandbox).concat(
            Object.getOwnPropertyNames(Object.getPrototypeOf(sandbox)),
          ),
        },
        'Sandbox created and tracked successfully',
      );

      // Generate TypeScript code for HTTP execution with enhanced error handling
      const httpCode = this.generateHttpExecutionCode(request);

      // Execute the HTTP request in the sandbox with timeout
      const executionPromise = sandbox.process.codeRun(httpCode, undefined, timeout);
      const executionTimeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error(`HTTP execution timeout after ${timeout}ms`)),
          timeout + 5000,
        );
      });

      const response = await Promise.race([executionPromise, executionTimeoutPromise]);

      const duration = Date.now() - startTime;

      // Parse the sandbox response
      const result = this.parseSandboxResponse(response, executionId, duration, sandboxId);

      this.logger.info(
        {
          executionId,
          sandboxId,
          statusCode: result.statusCode,
          duration,
          success: result.success,
          executedInSandbox: result.executedInSandbox,
          activeSandboxes: this.activeSandboxes.size,
        },
        'HTTP execution completed in Daytona sandbox',
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        {
          executionId,
          error: errorMessage,
          duration,
          sandboxCreated: sandbox !== null,
        },
        'HTTP execution failed in Daytona sandbox',
      );

      // Determine error type for better handling
      let errorType: 'network' | 'timeout' | 'sandbox' | 'execution' = 'sandbox';

      if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
        errorType = 'timeout';
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        errorType = 'network';
      } else if (errorMessage.includes('execution') || errorMessage.includes('parse')) {
        errorType = 'execution';
      }

      // If sandbox creation or execution fails, fall back to direct HTTP
      if (errorType === 'sandbox' || errorType === 'timeout') {
        this.logger.warn(`Sandbox execution failed (${errorType}), falling back to direct HTTP`);
        return this.executeDirectHttp(request, executionId, startTime);
      }

      return {
        success: false,
        statusCode: 500,
        headers: {},
        data: null,
        duration,
        executionId,
        executedInSandbox: sandbox !== null,
        sandboxId,
        error: {
          message: errorMessage,
          type: errorType,
        },
      };
    } finally {
      // Cleanup sandbox if created
      if (sandbox && executionId) {
        const startCleanup = Date.now();
        try {
          // Try multiple cleanup methods based on Daytona SDK
          if (typeof sandbox.destroy === 'function') {
            await sandbox.destroy();
          } else if (typeof sandbox.terminate === 'function') {
            await sandbox.terminate();
          } else if (typeof sandbox.stop === 'function') {
            await sandbox.stop();
          } else if (typeof sandbox.kill === 'function') {
            await sandbox.kill();
          } else {
            this.logger.warn(
              {
                executionId,
                sandboxId,
                availableMethods: Object.getOwnPropertyNames(sandbox).concat(
                  Object.getOwnPropertyNames(Object.getPrototypeOf(sandbox)),
                ),
              },
              'No known cleanup method found on sandbox object',
            );
            // Still mark as cleaned up since we can't do anything
          }

          const cleanupDuration = Date.now() - startCleanup;
          this.logger.info(
            {
              executionId,
              sandboxId,
              cleanupDuration,
            },
            'Sandbox cleanup attempted successfully',
          );
        } catch (cleanupError) {
          this.logger.error(
            {
              executionId,
              sandboxId,
              error: cleanupError instanceof Error ? cleanupError.message : 'Unknown cleanup error',
            },
            `Failed to cleanup sandbox ${executionId}`,
          );
        } finally {
          // Always remove from tracking, even if destroy fails
          this.activeSandboxes.delete(executionId);
          this.logger.info(
            {
              executionId,
              sandboxId,
              remainingActiveSandboxes: this.activeSandboxes.size,
            },
            'Sandbox removed from active tracking',
          );
        }
      }
    }
  }

  private async getOrCreateSandbox(executionId: string) {
    // Create a new sandbox for each execution for isolation
    // Each sandbox gets a unique identifier for tracking
    const sandbox = await this.daytona.create({
      language: 'typescript',
      envVars: {
        NODE_ENV: 'production',
        USER_AGENT: 'Tolstoy-Daytona-Executor/1.0',
        EXECUTION_ID: executionId,
      },
    });

    this.logger.debug({ executionId, sandboxId: sandbox.id }, 'New Daytona sandbox created');
    return sandbox;
  }

  private generateHttpExecutionCode(request: HttpExecutionRequest): string {
    const { url, method, headers, body, timeout } = request;

    return `
// HTTP execution in Daytona sandbox with enhanced error handling
async function executeHttpRequest() {
  const startTime = Date.now();
  
  try {
    console.log('[TOLSTOY] Starting HTTP request:', { method: "${method}", url: "${url}" });
    
    // Create AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.log('[TOLSTOY] Request aborted due to timeout');
    }, ${timeout || 30000});
    
    const response = await fetch("${url}", {
      method: "${method}",
      headers: ${JSON.stringify(headers)},
      ${body ? `body: ${JSON.stringify(body)},` : ''}
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    console.log('[TOLSTOY] Response received:', { 
      status: response.status, 
      statusText: response.statusText,
      headers: Object.keys(Object.fromEntries(response.headers.entries())).length + ' headers'
    });
    
    const responseText = await response.text();
    let responseData: any;
    
    try {
      responseData = JSON.parse(responseText);
      console.log('[TOLSTOY] Response parsed as JSON');
    } catch {
      responseData = responseText;
      console.log('[TOLSTOY] Response kept as text');
    }
    
    const duration = Date.now() - startTime;
    
    // Return structured result
    const result = {
      success: response.ok,
      statusCode: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data: responseData,
      duration,
      url: response.url
    };
    
    console.log(JSON.stringify({ 
      type: 'TOLSTOY_HTTP_RESULT', 
      result 
    }));
    
    return result;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    console.error('[TOLSTOY] HTTP request failed:', error?.message || 'Unknown error');
    
    let errorType = 'network';
    if (error?.name === 'AbortError') {
      errorType = 'timeout';
    } else if (error?.message && (error.message.includes('network') || error.message.includes('fetch'))) {
      errorType = 'network';
    }
    
    const errorResult = {
      success: false,
      statusCode: 0,
      headers: {},
      data: null,
      duration,
      error: {
        message: error?.message || 'Unknown error',
        name: error?.name || 'Error',
        type: errorType,
        stack: error?.stack
      }
    };
    
    console.log(JSON.stringify({ 
      type: 'TOLSTOY_HTTP_RESULT', 
      result: errorResult 
    }));
    
    return errorResult;
  }
}

// Execute and handle any uncaught errors
executeHttpRequest().catch((error: any) => {
  console.error('[TOLSTOY] Uncaught error in HTTP execution:', error);
  const errorResult = {
    success: false,
    statusCode: 0,
    headers: {},
    data: null,
    duration: 0,
    error: {
      message: 'Uncaught execution error: ' + (error?.message || 'Unknown error'),
      type: 'execution'
    }
  };
  console.log(JSON.stringify({ 
    type: 'TOLSTOY_HTTP_RESULT', 
    result: errorResult 
  }));
});
`;
  }

  private parseSandboxResponse(
    sandboxResponse: any,
    executionId: string,
    duration: number,
    sandboxId?: string,
  ): HttpExecutionResponse {
    this.logger.debug(
      {
        executionId,
        responseType: typeof sandboxResponse,
        responseKeys: Object.keys(sandboxResponse || {}),
        hasResult: !!sandboxResponse?.result,
        hasStdout: !!sandboxResponse?.stdout,
      },
      'Parsing sandbox response',
    );

    try {
      // Parse stdout to find our structured result
      const output =
        sandboxResponse.result || sandboxResponse.stdout || sandboxResponse.output || '';

      if (!output) {
        this.logger.warn({ executionId }, 'No output from sandbox response');
        return {
          success: false,
          statusCode: 500,
          headers: {},
          data: null,
          duration,
          executionId,
          executedInSandbox: true,
          sandboxId,
          error: {
            message: 'No output from sandbox execution',
            type: 'execution',
          },
        };
      }

      const lines = output.toString().split('\n');
      this.logger.debug(
        { executionId, totalLines: lines.length },
        'Processing sandbox output lines',
      );

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }

        try {
          const parsed = JSON.parse(line);
          if (parsed.type === 'TOLSTOY_HTTP_RESULT') {
            this.logger.debug({ executionId }, 'Found TOLSTOY_HTTP_RESULT in sandbox output');
            return {
              ...parsed.result,
              executionId,
              duration: parsed.result.duration || duration,
              executedInSandbox: true,
              sandboxId,
            };
          }
        } catch {
          // Skip non-JSON lines
          this.logger.debug(
            { executionId, line: line.substring(0, 100) },
            'Skipping non-JSON line',
          );
        }
      }

      // Log full output for debugging
      this.logger.warn(
        {
          executionId,
          output: output.toString().substring(0, 1000),
          outputLength: output.toString().length,
        },
        'No TOLSTOY_HTTP_RESULT found in sandbox output',
      );

      // Fallback if no structured result found
      return {
        success: false,
        statusCode: 500,
        headers: {},
        data: output.toString(),
        duration,
        executionId,
        executedInSandbox: true,
        sandboxId,
        error: {
          message: 'Could not parse sandbox response - no TOLSTOY_HTTP_RESULT found',
          type: 'execution',
        },
      };
    } catch (error) {
      this.logger.error(
        {
          executionId,
          error: error instanceof Error ? error.message : 'Unknown error',
          sandboxResponse: JSON.stringify(sandboxResponse, null, 2).substring(0, 500),
        },
        'Failed to parse sandbox response',
      );

      return {
        success: false,
        statusCode: 500,
        headers: {},
        data: null,
        duration,
        executionId,
        executedInSandbox: true,
        sandboxId,
        error: {
          message: error instanceof Error ? error.message : 'Unknown parsing error',
          type: 'execution',
        },
      };
    }
  }

  private async executeDirectHttp(
    request: HttpExecutionRequest,
    executionId: string,
    startTime: number,
  ): Promise<HttpExecutionResponse> {
    try {
      const requestOptions: RequestInit = {
        method: request.method,
        headers: request.headers,
      };

      if (request.body) {
        requestOptions.body = request.body;
      }

      const response = await fetch(request.url, requestOptions);
      const responseText = await response.text();

      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }

      const duration = Date.now() - startTime;

      return {
        success: response.ok,
        statusCode: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        data: responseData,
        duration,
        executionId,
        executedInSandbox: false,
        sandboxId: undefined,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        statusCode: 0,
        headers: {},
        data: null,
        duration,
        executionId,
        executedInSandbox: false,
        sandboxId: undefined,
        error: {
          message: error instanceof Error ? error.message : 'Unknown network error',
          type: 'network',
        },
      };
    }
  }

  async isDaytonaAvailable(): Promise<boolean> {
    return this.isInitialized && this.daytona !== null;
  }

  async getStatus(): Promise<{
    available: boolean;
    activeSandboxes: number;
    initialized: boolean;
  }> {
    return {
      available: await this.isDaytonaAvailable(),
      activeSandboxes: this.activeSandboxes.size,
      initialized: this.isInitialized,
    };
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.info('Cleaning up Daytona service...');

    // Clean up any active sandboxes
    for (const [id, sandboxData] of this.activeSandboxes.entries()) {
      try {
        const sandbox = sandboxData.sandbox;
        if (typeof sandbox.destroy === 'function') {
          await sandbox.destroy();
        } else if (typeof sandbox.terminate === 'function') {
          await sandbox.terminate();
        } else if (typeof sandbox.stop === 'function') {
          await sandbox.stop();
        } else if (typeof sandbox.kill === 'function') {
          await sandbox.kill();
        }
        this.logger.debug(`Cleaned up sandbox: ${id}`);
      } catch (error) {
        this.logger.warn(`Failed to cleanup sandbox ${id}:`, error);
      }
    }

    this.activeSandboxes.clear();
    this.logger.info('Daytona service cleanup completed');
  }
}
