import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';

export interface ExecutionLogInputs {
  stepName: string;
  stepType: string;
  config: Record<string, unknown>;
  executeIf?: string;
  variables: Record<string, unknown>;
  stepOutputs: Record<string, unknown>;
}

export interface ExecutionLogOutputs {
  [key: string]: unknown;
}

export interface ExecutionLogError {
  message: string;
  code: string;
  stack?: string;
  [key: string]: unknown;
}

export class CreateExecutionLogDto {
  @ApiProperty({
    description: 'ID of the workflow being executed',
    example: 'flow_abc123',
  })
  @IsString()
  @IsNotEmpty()
  flowId: string;

  @ApiProperty({
    description: 'Unique execution instance ID',
    example: 'exec_xyz789',
  })
  @IsString()
  @IsNotEmpty()
  executionId: string;

  @ApiProperty({
    description: 'Unique identifier for the step within the workflow',
    example: 'send_notification',
  })
  @IsString()
  @IsNotEmpty()
  stepKey: string;

  @ApiProperty({
    description: 'Input data provided to the step',
    example: {
      channel: '#general',
      message: 'Workflow started',
      userId: 'user_123',
    },
  })
  @IsObject()
  @IsNotEmpty()
  inputs: Prisma.InputJsonValue;

  @ApiPropertyOptional({
    description: 'Output data produced by the step',
    example: {
      messageId: 'msg_456',
      timestamp: '2024-01-15T10:30:05Z',
      success: true,
    },
  })
  @IsObject()
  @IsOptional()
  outputs?: Prisma.InputJsonValue;

  @ApiPropertyOptional({
    description: 'Error information if step failed',
    example: {
      message: 'API rate limit exceeded',
      code: 'RATE_LIMIT',
      retryAfter: 3600,
    },
  })
  @IsObject()
  @IsOptional()
  error?: Prisma.InputJsonValue;

  @ApiProperty({
    description: 'Execution status',
    enum: ['pending', 'running', 'completed', 'failed'],
    example: 'completed',
  })
  @IsString()
  @IsNotEmpty()
  status: string;
}
