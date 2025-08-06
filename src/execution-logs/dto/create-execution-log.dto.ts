import { IsString, IsNotEmpty, IsObject, IsOptional } from 'class-validator';

export class CreateExecutionLogDto {
  @IsString()
  @IsNotEmpty()
  flowId: string;

  @IsString()
  @IsNotEmpty()
  stepId: string;

  @IsObject()
  @IsNotEmpty()
  inputs: Record<string, any>;

  @IsObject()
  @IsOptional()
  outputs?: Record<string, any>;

  @IsString()
  @IsNotEmpty()
  status: string;
}