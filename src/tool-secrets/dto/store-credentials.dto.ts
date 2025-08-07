import { IsObject, IsNotEmpty, ValidateNested, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class StoreCredentialsDto {
  @IsObject()
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => Object)
  credentials: any;
}

export class CredentialResponseDto {
  @IsString()
  toolId: string;

  @IsString()
  toolName: string;

  @IsObject()
  maskedCredentials: any;

  createdAt: Date;

  updatedAt: Date;
}