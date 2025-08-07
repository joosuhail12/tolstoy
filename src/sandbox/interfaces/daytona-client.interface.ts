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

export interface DaytonaRunRequest {
  code: string;
  context: Record<string, any>;
  language?: string;
  timeout?: number;
}

export interface DaytonaRunResponse {
  success: boolean;
  output: any;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  executionTime: number;
}

export interface DaytonaSessionRequest {
  code: string;
  context: Record<string, any>;
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
  output?: any;
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