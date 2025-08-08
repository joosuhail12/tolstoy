import { IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ExecuteActionDto {
  @ApiProperty({ 
    description: 'Inputs matching the action\'s inputSchema',
    example: {
      channel: '#general',
      text: 'Hello World',
      user_id: 'U123456'
    }
  })
  @IsObject()
  inputs: Record<string, any>;
}