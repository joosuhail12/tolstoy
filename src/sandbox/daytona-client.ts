import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AwsSecretsService } from '../aws-secrets.service';
import {
  DaytonaClient,
  DaytonaRunRequest,
  DaytonaRunResponse,
  DaytonaSessionRequest,
  DaytonaSessionResponse,
  DaytonaSessionResult,
} from './interfaces/daytona-client.interface';

/**
 * Daytona Client Implementation
 *
 * This is a mock implementation of the Daytona client that matches the expected API.
 * When the actual @daytona/sdk package becomes available, this should be replaced
 * with the real client import.
 *
 * Usage:
 * import { DaytonaClient } from '@daytona/sdk';
 *
 * For now, this provides a working implementation for development and testing.
 */
@Injectable()
export class DaytonaClientImpl implements DaytonaClient {
  private apiKey: string = '';
  private baseUrl: string = '';
  private timeout: number = 30000;
  private configInitialized: boolean = false;

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly awsSecretsService?: AwsSecretsService,
  ) {
    // Initialize config synchronously with fallback values, then load from AWS Secrets if available
    this.initializeConfig();
  }

  private initializeConfig(): void {
    // Set defaults from environment variables first
    this.apiKey = this.configService.get('DAYTONA_API_KEY') || '';
    this.baseUrl = this.configService.get('DAYTONA_BASE_URL') || 'https://api.daytona.dev';
    this.timeout = this.configService.get('DAYTONA_TIMEOUT') || 30000;
    this.configInitialized = false;
  }

  private async loadConfigFromAwsSecrets(): Promise<void> {
    if (this.configInitialized || !this.awsSecretsService) {
      return;
    }

    try {
      // Try to load from AWS Secrets Manager, fallback to environment variables if not available
      const useAwsSecrets = this.configService.get('USE_AWS_SECRETS') === 'true';

      if (useAwsSecrets) {
        try {
          this.apiKey = await this.awsSecretsService.getDaytonaApiKey();
          this.baseUrl = await this.awsSecretsService.getDaytonaBaseUrl();
          this.timeout = parseInt(await this.awsSecretsService.getDaytonaSyncTimeout(), 10);
          // console.log('Loaded Daytona config from AWS Secrets Manager');
        } catch {
          // Fall back to environment variables if AWS secrets are not available
          // console.log('Falling back to environment variables for Daytona config');
        }
      }

      this.configInitialized = true;
    } catch {
      // If all else fails, keep the defaults from environment variables
      this.configInitialized = true;
    }
  }

  async run(request: DaytonaRunRequest): Promise<DaytonaRunResponse> {
    await this.loadConfigFromAwsSecrets();
    const startTime = Date.now();

    try {
      // In a real implementation, this would make an HTTP request to Daytona API
      const response = await this.makeApiRequest('/run', {
        method: 'POST',
        body: JSON.stringify(request),
      });

      const executionTime = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          output: data.output,
          executionTime,
        };
      } else {
        const error = await response.json();
        return {
          success: false,
          output: null,
          error: {
            message: error instanceof Error ? error.message : 'Sandbox execution failed',
            code:
              error instanceof Error && (error as any).code
                ? (error as any).code
                : 'EXECUTION_ERROR',
          },
          executionTime,
        };
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        success: false,
        output: null,
        error: {
          message:
            error instanceof Error ? error.message : 'Network error during sandbox execution',
          code: 'NETWORK_ERROR',
          stack: error instanceof Error ? error.stack : 'No stack trace',
        },
        executionTime,
      };
    }
  }

  async startSession(request: DaytonaSessionRequest): Promise<DaytonaSessionResponse> {
    await this.loadConfigFromAwsSecrets();
    try {
      // In a real implementation, this would make an HTTP request to Daytona API
      const response = await this.makeApiRequest('/sessions', {
        method: 'POST',
        body: JSON.stringify(request),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          sessionId: data.sessionId,
          status: 'pending',
          createdAt: new Date().toISOString(),
        };
      } else {
        const error = await response.json();
        throw new Error(
          `Failed to start session: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    } catch (error) {
      throw new Error(
        `Failed to start async session: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getSessionResult(sessionId: string): Promise<DaytonaSessionResult> {
    await this.loadConfigFromAwsSecrets();
    try {
      // In a real implementation, this would make an HTTP request to Daytona API
      const response = await this.makeApiRequest(`/sessions/${sessionId}`, {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        return {
          sessionId: data.sessionId,
          status: data.status,
          output: data.output,
          error: data.error,
          executionTime: data.executionTime,
          completedAt: data.completedAt,
        };
      } else {
        const error = await response.json();
        throw new Error(
          `Failed to get session result: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    } catch (error) {
      throw new Error(
        `Failed to retrieve session result: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async cancelSession(sessionId: string): Promise<void> {
    await this.loadConfigFromAwsSecrets();
    try {
      // In a real implementation, this would make an HTTP request to Daytona API
      const response = await this.makeApiRequest(`/sessions/${sessionId}/cancel`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `Failed to cancel session: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    } catch (error) {
      throw new Error(
        `Failed to cancel session: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private async makeApiRequest(endpoint: string, options: RequestInit): Promise<Response> {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      'User-Agent': 'tolstoy-daytona-client/1.0.0',
    };

    const requestOptions: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {}),
      },
    };

    // For development/testing, we'll simulate API responses
    return this.simulateApiResponse(endpoint, requestOptions);
  }

  /**
   * Simulate Daytona API responses for development and testing
   * This should be removed when integrating with the real Daytona API
   */
  private async simulateApiResponse(endpoint: string, _options: RequestInit): Promise<Response> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 400));

    const mockResponses: any = {
      '/run': {
        status: 200,
        json: async () => ({
          output: {
            result: 'Mock execution result',
            logs: ['Executing code in sandbox...', 'Execution completed'],
            exitCode: 0,
          },
        }),
      },
      '/sessions': {
        status: 200,
        json: async () => ({
          sessionId: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        }),
      },
      '/sessions/:id': {
        status: 200,
        json: async () => ({
          sessionId: 'mock_session_id',
          status: Math.random() > 0.7 ? 'completed' : 'running',
          output: {
            result: 'Mock async execution result',
            logs: ['Async execution started...', 'Processing...', 'Completed'],
            exitCode: 0,
          },
          executionTime: 1500,
          completedAt: new Date().toISOString(),
        }),
      },
    };

    // Match dynamic routes
    let routeKey = endpoint;
    if (endpoint.includes('/sessions/') && endpoint.includes('/cancel')) {
      routeKey = '/sessions/:id/cancel';
      mockResponses[routeKey] = {
        status: 200,
        json: async () => ({ message: 'Session cancelled successfully' }),
      };
    } else if (endpoint.includes('/sessions/') && !endpoint.includes('/cancel')) {
      routeKey = '/sessions/:id';
    }

    const mockResponse = mockResponses[routeKey] || mockResponses[endpoint];

    if (mockResponse) {
      return {
        ok: mockResponse.status < 400,
        status: mockResponse.status,
        json: mockResponse.json,
      } as Response;
    }

    // Default error response
    return {
      ok: false,
      status: 404,
      json: async () => ({ message: 'Endpoint not found', code: 'NOT_FOUND' }),
    } as Response;
  }
}
