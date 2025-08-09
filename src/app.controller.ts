import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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

  @Get('version')
  @ApiOperation({
    summary: 'Version Information',
    description: 'Get version information including build details and commit hash',
  })
  @ApiResponse({
    status: 200,
    description: 'Version information retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        version: { type: 'string', example: '1.0.0' },
        commit: { type: 'string', example: 'abc123def456' },
        buildTime: { type: 'string', example: '2025-08-09T10:30:00.000Z' },
        nodeVersion: { type: 'string', example: '20.11.0' },
        environment: { type: 'string', example: 'production' },
      },
    },
  })
  getVersion(): {
    version: string;
    commit: string;
    buildTime: string;
    nodeVersion: string;
    environment: string;
  } {
    return this.appService.getVersion();
  }
}
