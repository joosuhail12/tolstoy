import { Controller, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { HealthService, HealthCheck, DatabaseHealthCheck } from './health.service';

@ApiTags('Health')
@Controller('status')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'Health Check',
    description: 'Get basic application health status',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved health status',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', format: 'date-time' },
        uptime: { type: 'number', example: 12345.678 },
        version: { type: 'string', example: '1.0.0' },
      },
    },
  })
  async getHealth(): Promise<HealthCheck> {
    return this.healthService.getHealthStatus();
  }

  @Get('detailed')
  @ApiOperation({
    summary: 'Detailed Health Check',
    description: 'Get comprehensive health status including database, environment, and system information',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved detailed health status',
    schema: {
      type: 'object',
      properties: {
        application: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ok' },
            timestamp: { type: 'string', format: 'date-time' },
            uptime: { type: 'number', example: 12345.678 },
            version: { type: 'string', example: '1.0.0' },
          },
        },
        database: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'connected' },
            responseTime: { type: 'number', example: 15.2 },
            connection: { type: 'string', example: 'postgresql://...' },
          },
        },
        environment: {
          type: 'object',
          description: 'Environment configuration (sensitive values masked)',
          example: { NODE_ENV: 'development', PORT: 3000 },
        },
        system: {
          type: 'object',
          description: 'System information',
          example: { platform: 'linux', arch: 'x64', nodeVersion: '18.17.0' },
        },
      },
    },
  })
  async getDetailedHealth(): Promise<{
    application: HealthCheck;
    database: DatabaseHealthCheck;
    environment: Record<string, unknown>;
    system: Record<string, unknown>;
  }> {
    return this.healthService.getDetailedHealthStatus();
  }
}
