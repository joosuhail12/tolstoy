import { ApiProperty } from '@nestjs/swagger';

export class AuthConfigResponseDto {
  @ApiProperty({ description: 'Unique identifier for the auth config' })
  id: string;

  @ApiProperty({ description: 'Organization ID' })
  orgId: string;

  @ApiProperty({ description: 'Tool ID' })
  toolId: string;

  @ApiProperty({
    description: 'Configuration name',
    example: 'default',
  })
  name: string;

  @ApiProperty({
    enum: ['apiKey', 'oauth2'],
    description: 'Type of authentication configuration',
  })
  type: string;

  @ApiProperty({
    description: 'Authentication configuration (sensitive values may be masked)',
  })
  config: Record<string, unknown>;

  @ApiProperty({
    description: 'Whether this is the default configuration for the tool',
    example: false,
  })
  isDefault: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class AuthConfigListResponseDto {
  @ApiProperty({
    type: [AuthConfigResponseDto],
    description: 'List of auth configurations for the tool',
  })
  configs: AuthConfigResponseDto[];

  @ApiProperty({
    description: 'Total number of configurations',
    example: 3,
  })
  total: number;
}

export class DeleteAuthConfigResponseDto {
  @ApiProperty({ description: 'Operation success status', example: true })
  success: boolean;

  @ApiProperty({
    description: 'Success message',
    example: 'Auth configuration deleted successfully',
  })
  message: string;
}
