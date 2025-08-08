import { IsObject, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateFlowDto {
  @IsNumber()
  @IsOptional()
  @Min(1)
  version?: number = 1;

  @IsObject()
  @IsNotEmpty()
  steps: Array<{
    id: string;
    type: string;
    name: string;
    config: Record<string, unknown>;
    executeIf?: string | Record<string, unknown>;
    dependsOn?: string[];
    retryPolicy?: {
      maxRetries: number;
      backoffStrategy: 'fixed' | 'exponential';
      delayMs: number;
    };
  }>;
}
