import { IsString, IsNotEmpty, IsObject, IsOptional, IsArray, IsNumber } from 'class-validator';

export class CreateActionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  @IsNotEmpty()
  toolId: string;

  @IsString()
  @IsNotEmpty()
  method: string;

  @IsString()
  @IsNotEmpty()
  endpoint: string;

  @IsObject()
  @IsNotEmpty()
  headers: Record<string, string>;

  @IsArray()
  @IsNotEmpty()
  inputSchema: Array<{
    name: string;
    type: string;
    required?: boolean;
    description?: string;
  }>;

  @IsObject()
  @IsOptional()
  executeIf?: Record<string, unknown>;

  @IsNumber()
  @IsOptional()
  version?: number;
}
