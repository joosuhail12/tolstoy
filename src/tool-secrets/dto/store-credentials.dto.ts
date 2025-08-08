import { IsObject, IsNotEmpty, ValidateNested, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class StoreCredentialsDto {
  @IsObject()
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => Object)
  credentials: Record<string, unknown>;
}

export class CredentialResponseDto {
  @IsString()
  toolId: string;

  @IsString()
  toolName: string;

  @IsObject()
  maskedCredentials: Record<string, string>;

  createdAt: Date;

  updatedAt: Date;
}
