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
  inputs: any;

  @IsObject()
  @IsOptional()
  outputs?: any;

  @IsString()
  @IsNotEmpty()
  status: string;
}
