import { IsArray, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

interface InputSchemaItem {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
}

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
  inputSchema: InputSchemaItem[];

  @IsObject()
  @IsOptional()
  executeIf?: Record<string, unknown>;

  @IsNumber()
  @IsOptional()
  version?: number;
}
