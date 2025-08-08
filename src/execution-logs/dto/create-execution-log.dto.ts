import { IsString, IsNotEmpty, IsObject, IsOptional } from 'class-validator';
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
  @IsString()
  @IsNotEmpty()
  flowId: string;

  @IsString()
  @IsNotEmpty()
  executionId: string;

  @IsString()
  @IsNotEmpty()
  stepKey: string;

  @IsObject()
  @IsNotEmpty()
  inputs: Prisma.InputJsonValue;

  @IsObject()
  @IsOptional()
  outputs?: Prisma.InputJsonValue;

  @IsObject()
  @IsOptional()
  error?: Prisma.InputJsonValue;

  @IsString()
  @IsNotEmpty()
  status: string;
}
