import { IsArray, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

interface InputSchemaItem {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
}

export class CreateActionDto {
  @ApiProperty({
    description: 'Human-readable action name',
    example: 'Send Slack Message',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Unique identifier for the action',
    example: 'slack_send_message',
  })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({
    description: 'ID of the associated tool',
    example: 'tool_slack_123',
  })
  @IsString()
  @IsNotEmpty()
  toolId: string;

  @ApiProperty({
    description: 'HTTP method for the action',
    enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    example: 'POST',
  })
  @IsString()
  @IsNotEmpty()
  method: string;

  @ApiProperty({
    description: 'API endpoint URL or path',
    example: '/api/chat.postMessage',
  })
  @IsString()
  @IsNotEmpty()
  endpoint: string;

  @ApiProperty({
    description: 'HTTP headers required for the action',
    example: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer {token}',
    },
  })
  @IsObject()
  @IsNotEmpty()
  headers: Record<string, string>;

  @ApiProperty({
    description: 'Schema defining input parameters for the action',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'channel' },
        type: { type: 'string', example: 'string' },
        required: { type: 'boolean', example: true },
        description: { type: 'string', example: 'Slack channel ID' },
      },
    },
    example: [
      {
        name: 'channel',
        type: 'string',
        required: true,
        description: 'Slack channel ID',
      },
      {
        name: 'text',
        type: 'string',
        required: true,
        description: 'Message content',
      },
    ],
  })
  @IsArray()
  @IsNotEmpty()
  inputSchema: InputSchemaItem[];

  @ApiPropertyOptional({
    description: 'Conditional execution rules (optional)',
    example: { 'user.role': 'admin' },
  })
  @IsObject()
  @IsOptional()
  executeIf?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Action version number',
    example: 1,
  })
  @IsNumber()
  @IsOptional()
  version?: number;
}
