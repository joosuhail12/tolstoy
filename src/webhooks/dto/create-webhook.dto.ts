import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWebhookDto {
  @ApiProperty({
    description: 'Webhook name',
    example: 'Production Notifications',
    minLength: 3,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Webhook endpoint URL',
    format: 'uri',
    example: 'https://api.example.com/webhook',
  })
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
  })
  @IsNotEmpty()
  url: string;

  @ApiProperty({
    description: 'Event types to subscribe to',
    type: [String],
    example: ['flow.execution.completed', 'flow.execution.failed'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  eventTypes: string[];

  @ApiPropertyOptional({
    description: 'Whether the webhook is active',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Optional secret for webhook signature verification',
    example: 'webhook_secret_123',
    minLength: 16,
    maxLength: 256,
  })
  @IsString()
  @IsOptional()
  @MinLength(16)
  @MaxLength(256)
  secret?: string;

  @ApiPropertyOptional({
    description: 'Additional HTTP headers to include with webhook requests',
    example: {
      'X-API-Key': 'your-api-key',
      'Content-Type': 'application/json',
    },
  })
  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;
}
