import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApiKeyAuthConfigDto {
  @ApiProperty({
    description: 'The name of the header where the API key should be placed',
    example: 'Authorization',
    examples: {
      authorization: {
        summary: 'Authorization Header',
        value: 'Authorization',
      },
      custom: {
        summary: 'Custom API Key Header',
        value: 'X-API-Key',
      },
    },
  })
  @IsString()
  @IsNotEmpty()
  headerName: string;

  @ApiProperty({
    description: 'The API key value (will be stored securely)',
    example: 'Bearer sk-1234567890abcdef',
    examples: {
      bearer: {
        summary: 'Bearer Token',
        value: 'Bearer sk-1234567890abcdef',
      },
      apiKey: {
        summary: 'Simple API Key',
        value: 'your-api-key-value-here',
      },
    },
  })
  @IsString()
  @IsNotEmpty()
  headerValue: string;
}