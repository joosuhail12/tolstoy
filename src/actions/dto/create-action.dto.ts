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
  headers: Record<string, any>;

  @IsArray()
  @IsNotEmpty()
  inputSchema: any[];

  @IsObject()
  @IsOptional()
  executeIf?: Record<string, any>;

  @IsNumber()
  @IsOptional()
  version?: number;
}