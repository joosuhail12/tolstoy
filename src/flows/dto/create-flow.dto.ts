import { IsObject, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

interface RetryPolicy {
  maxRetries: number;
  backoffStrategy: 'fixed' | 'exponential';
  delayMs: number;
}

interface FlowStep {
  id: string;
  type: string;
  name: string;
  config: Record<string, unknown>;
  executeIf?: string | Record<string, unknown>;
  dependsOn?: string[];
  retryPolicy?: RetryPolicy;
}

export class CreateFlowDto {
  @IsNumber()
  @IsOptional()
  @Min(1)
  version?: number = 1;

  @IsObject()
  @IsNotEmpty()
  steps: FlowStep[];
}
