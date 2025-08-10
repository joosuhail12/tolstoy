import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

interface RetryPolicy {
  maxRetries: number;
  backoffStrategy: 'fixed' | 'exponential';
  delayMs: number;
}

interface FlowStep {
  id: string;
  type: string;
  name?: string;
  actionId?: string;
  config: Record<string, unknown>;
  executeIf?: string | Record<string, unknown>;
  dependsOn?: string[];
  retryPolicy?: RetryPolicy;
}

export class CreateFlowDto {
  @ApiProperty({
    description: 'Flow name',
    example: 'User Onboarding Flow',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Flow description',
    example: 'Automated user onboarding process with email and notifications',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Flow version number',
    example: 1,
  })
  @IsNumber()
  @IsOptional()
  @Min(1)
  version?: number = 1;

  @ApiProperty({
    description: 'Workflow steps definition',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'step_1' },
        type: { type: 'string', example: 'action' },
        actionId: { type: 'string', example: 'action_abc123' },
        config: { type: 'object', example: { timeout: 30000 } },
      },
    },
    example: [
      {
        id: 'step_1',
        type: 'action',
        actionId: 'action_send_email',
        config: { to: '{{user.email}}', template: 'welcome' },
      },
    ],
  })
  @IsArray()
  @IsNotEmpty()
  steps: FlowStep[];

  @ApiPropertyOptional({
    description: 'Flow execution settings',
    example: { timeout: 300000, retries: 2 },
  })
  @IsObject()
  @IsOptional()
  settings?: Record<string, unknown>;
}
