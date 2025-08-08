import {
  IsString,
  IsNotEmpty,
  IsUrl,
  IsArray,
  IsOptional,
  IsBoolean,
  ArrayNotEmpty,
  ArrayUnique,
  IsObject,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateWebhookDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
  })
  @IsNotEmpty()
  url: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  eventTypes: string[];

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsString()
  @IsOptional()
  @MinLength(16)
  @MaxLength(256)
  secret?: string;

  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;
}
