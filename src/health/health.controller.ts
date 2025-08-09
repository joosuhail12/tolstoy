import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DatabaseHealthCheck, HealthCheck, HealthService } from './health.service';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  // Simple health endpoint for load balancers
  @Get('health')
  @ApiOperation({
    summary: 'Load Balancer Health Check',
    description: 'Simple health check endpoint for load balancers and monitoring systems',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
      },
    },
  })
  async getSimpleHealth(): Promise<{ status: string }> {
    // Simple health check - just return ok if the service is running
    return { status: 'ok' };
  }

  @Get('status')
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
    description:
      'Get comprehensive health status including database, environment, and system information',
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
    status: string;
    database: DatabaseHealthCheck;
    redis: HealthCheck;
    environment: Record<string, unknown>;
    system: Record<string, unknown>;
  }> {
    return this.healthService.getDetailedHealthStatus();
  }
}
