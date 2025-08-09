import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OAuthLoginQueryDto {
  @ApiProperty({
    description: 'User ID for whom to initiate OAuth',
    example: 'user_123',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class OAuthCallbackQueryDto {
  @ApiProperty({
    description: 'Authorization code returned by OAuth provider',
    example: 'abc123def456',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    description: 'State parameter to validate request origin',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiProperty({
    description: 'Error code if OAuth provider returned an error',
    example: 'access_denied',
    required: false,
  })
  @IsString()
  @IsOptional()
  error?: string;

  @ApiProperty({
    description: 'Error description if OAuth provider returned an error',
    example: 'The user denied the request',
    required: false,
  })
  @IsString()
  @IsOptional()
  error_description?: string;
}

export class OAuthToolParamDto {
  @ApiProperty({
    description: 'Tool key/identifier for OAuth provider',
    example: 'github',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  toolKey: string;
}
