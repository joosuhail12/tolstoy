import { IsObject, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateFlowDto {
  @IsNumber()
  @IsOptional()
  @Min(1)
  version?: number = 1;

  @IsObject()
  @IsNotEmpty()
  steps: any;
}
