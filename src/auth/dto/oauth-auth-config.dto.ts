import { IsNotEmpty, IsString, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OAuthAuthConfigDto {
  @ApiProperty({
    description: 'OAuth client ID obtained from the service provider',
    example: 'your-oauth-client-id',
  })
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @ApiProperty({
    description: 'OAuth client secret obtained from the service provider',
    example: 'your-oauth-client-secret',
  })
  @IsString()
  @IsNotEmpty()
  clientSecret: string;

  @ApiProperty({
    description: 'OAuth access token for authenticated requests',
    example: 'oauth2-access-token-here',
  })
  @IsString()
  @IsNotEmpty()
  accessToken: string;

  @ApiPropertyOptional({
    description: 'OAuth refresh token (if available for token renewal)',
    example: 'oauth2-refresh-token-here',
  })
  @IsString()
  @IsOptional()
  refreshToken?: string;

  @ApiPropertyOptional({
    description: 'OAuth scopes granted (space-separated)',
    example: 'read write admin',
  })
  @IsString()
  @IsOptional()
  scopes?: string;

  @ApiPropertyOptional({
    description: 'Token expiry timestamp (ISO string)',
    example: '2024-12-31T23:59:59.000Z',
  })
  @IsString()
  @IsOptional()
  expiresAt?: string;
}