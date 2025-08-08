import { Controller, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: 'Welcome Message',
    description: 'Get a welcome message from the Tolstoy API',
  })
  @ApiResponse({
    status: 200,
    description: 'Welcome message retrieved successfully',
    schema: {
      type: 'string',
      example: 'Welcome to Tolstoy - Workflow Automation Platform',
    },
  })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({
    summary: 'Basic Health Check',
    description: 'Simple health check endpoint (deprecated - use /status instead)',
  })
  @ApiResponse({
    status: 200,
    description: 'Basic health status',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2025-08-08T10:30:00.000Z' },
      },
    },
  })
  getHealth(): { status: string; timestamp: string } {
    return this.appService.getHealth();
  }
}
