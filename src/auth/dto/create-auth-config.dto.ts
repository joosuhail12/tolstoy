import { IsIn, IsNotEmpty, IsString, IsObject, Validate } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AuthConfigValidator } from './create-auth-config.validator';

export class CreateAuthConfigDto {
  @ApiProperty({
    enum: ['apiKey', 'oauth2'],
    description: 'Type of authentication configuration',
    example: 'apiKey',
    examples: {
      apiKey: {
        summary: 'API Key Authentication',
        value: 'apiKey',
      },
      oauth2: {
        summary: 'OAuth2 Authentication',
        value: 'oauth2',
      },
    },
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['apiKey', 'oauth2'])
  type: 'apiKey' | 'oauth2';

  @ApiProperty({
    description: 'Authentication configuration (structure depends on type)',
    examples: {
      apiKey: {
        summary: 'API Key Configuration',
        description: 'Configuration for API key-based authentication',
        value: {
          headerName: 'Authorization',
          headerValue: 'Bearer sk-1234567890abcdef',
        },
      },
      oauth2: {
        summary: 'OAuth2 Configuration',
        description: 'Configuration for OAuth2-based authentication',
        value: {
          clientId: 'your-oauth-client-id',
          clientSecret: 'your-oauth-client-secret',
          accessToken: 'oauth2-access-token-here',
          refreshToken: 'oauth2-refresh-token-here',
          scopes: 'read write',
          expiresAt: '2024-12-31T23:59:59.000Z',
        },
      },
    },
    oneOf: [
      {
        type: 'object',
        title: 'API Key Configuration',
        properties: {
          headerName: { type: 'string', example: 'Authorization' },
          headerValue: { type: 'string', example: 'Bearer sk-1234567890abcdef' },
        },
        required: ['headerName', 'headerValue'],
      },
      {
        type: 'object',
        title: 'OAuth2 Configuration',
        properties: {
          clientId: { type: 'string', example: 'your-oauth-client-id' },
          clientSecret: { type: 'string', example: 'your-oauth-client-secret' },
          accessToken: { type: 'string', example: 'oauth2-access-token-here' },
          refreshToken: { type: 'string', example: 'oauth2-refresh-token-here' },
          scopes: { type: 'string', example: 'read write' },
          expiresAt: { type: 'string', example: '2024-12-31T23:59:59.000Z' },
        },
        required: ['clientId', 'clientSecret', 'accessToken'],
      },
    ],
  })
  @IsObject()
  @IsNotEmpty()
  @Validate(AuthConfigValidator)
  config: Record<string, unknown>;
}
