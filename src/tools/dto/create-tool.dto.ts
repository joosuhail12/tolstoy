import { IsNotEmpty, IsString, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateToolDto {
  @ApiProperty({
    description: 'Tool name',
    example: 'Slack Notifier',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Base URL for the tool API',
    example: 'https://hooks.slack.com/services',
    format: 'uri',
  })
  @IsUrl()
  @IsNotEmpty()
  baseUrl: string;

  @ApiProperty({
    description: 'Authentication type (apiKey, oauth2, basic)',
    example: 'apiKey',
  })
  @IsString()
  @IsNotEmpty()
  authType: string;
}
