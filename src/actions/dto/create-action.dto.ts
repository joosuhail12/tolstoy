import { IsString, IsNotEmpty, IsObject, IsOptional } from 'class-validator';

export class CreateActionDto {
  @IsString()
  @IsNotEmpty()
  toolId: string;

  @IsString()
  @IsNotEmpty()
  endpoint: string;

  @IsString()
  @IsNotEmpty()
  method: string;

  @IsObject()
  @IsNotEmpty()
  schema: Record<string, any>;

  @IsString()
  @IsOptional()
  executeIf?: string;
}