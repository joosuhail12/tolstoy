import { Controller, Get } from '@nestjs/common';
import { HealthService, HealthCheck, DatabaseHealthCheck } from './health.service';

@Controller('status')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async getHealth(): Promise<HealthCheck> {
    return this.healthService.getHealthStatus();
  }

  @Get('detailed')
  async getDetailedHealth(): Promise<{
    application: HealthCheck;
    database: DatabaseHealthCheck;
    environment: any;
    system: any;
  }> {
    return this.healthService.getDetailedHealthStatus();
  }
}