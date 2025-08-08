/**
 * Daytona SDK Client Interface
 *
 * This interface defines the expected structure of the Daytona SDK client.
 * When the actual @daytona/sdk package becomes available, this interface
 * should match the real API.
 */
export interface DaytonaClientConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

export interface ExecutionContext {
  variables?: Record<string, unknown>;
  stepOutputs?: Record<string, unknown>;
  orgId: string;
  userId: string;
  flowId: string;
  stepId: string;
  executionId: string;
}

export interface DaytonaRunRequest {
  code: string;
  context: ExecutionContext;
  language?: string;
  timeout?: number;
}

export interface DaytonaRunResponse {
  success: boolean;
  output: unknown;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  executionTime: number;
}

export interface DaytonaSessionRequest {
  code: string;
  context: ExecutionContext;
  language?: string;
  timeout?: number;
}

export interface DaytonaSessionResponse {
  sessionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
}

export interface DaytonaSessionResult {
  sessionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output?: unknown;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  executionTime?: number;
  completedAt?: string;
}

export interface DaytonaClient {
  run(request: DaytonaRunRequest): Promise<DaytonaRunResponse>;
  startSession(request: DaytonaSessionRequest): Promise<DaytonaSessionResponse>;
  getSessionResult(sessionId: string): Promise<DaytonaSessionResult>;
  cancelSession(sessionId: string): Promise<void>;
}
