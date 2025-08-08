import { IsIn, IsObject, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAuthConfigDto {
  @ApiProperty({
    enum: ['apiKey', 'oauth2'],
    description: 'Type of authentication configuration',
    example: 'apiKey',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['apiKey', 'oauth2'])
  type: 'apiKey' | 'oauth2';

  @ApiProperty({
    description: 'Authentication configuration JSON',
    examples: {
      apiKey: {
        summary: 'API Key Configuration',
        value: {
          apiKey: 'your-api-key-here',
          header: 'X-API-Key',
        },
      },
      oauth2: {
        summary: 'OAuth2 Configuration',
        value: {
          clientId: 'your-client-id',
          clientSecret: 'your-client-secret',
          redirectUri: 'https://your-app.com/oauth/callback',
          scope: 'read write',
        },
      },
    },
  })
  @IsObject()
  @IsNotEmpty()
  config: Record<string, any>;
}
