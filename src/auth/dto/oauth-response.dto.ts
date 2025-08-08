import { ApiProperty } from '@nestjs/swagger';

export class OAuthLoginResponseDto {
  @ApiProperty({
    description: 'OAuth authorization URL to redirect user to',
    example: 'https://github.com/login/oauth/authorize?client_id=abc123&redirect_uri=...',
  })
  authorizeUrl: string;

  @ApiProperty({
    description: 'OAuth state parameter for request validation',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  state: string;
}

export class OAuthCallbackResponseDto {
  @ApiProperty({
    description: 'Whether OAuth callback was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Success message',
    example: 'OAuth authorization completed successfully',
    required: false,
  })
  message?: string;

  @ApiProperty({
    description: 'User credential ID that was created/updated',
    example: 'cred_123456789',
    required: false,
  })
  credentialId?: string;
}

export class OAuthErrorResponseDto {
  @ApiProperty({
    description: 'Whether the operation was successful',
    example: false,
  })
  success: boolean;

  @ApiProperty({
    description: 'Error message describing what went wrong',
    example: 'Invalid OAuth state parameter',
  })
  message: string;

  @ApiProperty({
    description: 'Error code for programmatic handling',
    example: 'INVALID_STATE',
    required: false,
  })
  code?: string;
}
