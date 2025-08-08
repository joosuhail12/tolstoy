import { ApiProperty } from '@nestjs/swagger';

export class AuthConfigResponseDto {
  @ApiProperty({ description: 'Unique identifier for the auth config' })
  id: string;

  @ApiProperty({ description: 'Organization ID' })
  orgId: string;

  @ApiProperty({ description: 'Tool ID' })
  toolId: string;

  @ApiProperty({
    enum: ['apiKey', 'oauth2'],
    description: 'Type of authentication configuration',
  })
  type: string;

  @ApiProperty({
    description: 'Authentication configuration (sensitive values may be masked)',
  })
  config: Record<string, unknown>;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
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
