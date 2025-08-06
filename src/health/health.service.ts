import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  message: string;
  timestamp: string;
  details?: any;
}

export interface DatabaseHealthCheck extends HealthCheck {
  connectionTime?: number;
  recordCounts?: {
    organizations: number;
    users: number;
    tools: number;
    flows: number;
  };
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealthStatus(): Promise<HealthCheck> {
    try {
      const dbCheck = await this.checkDatabaseConnection();
      
      if (dbCheck.status === 'unhealthy') {
        return {
          status: 'unhealthy',
          message: 'Database connection failed',
          timestamp: new Date().toISOString(),
          details: { database: dbCheck }
        };
      }

      return {
        status: 'healthy',
        message: 'All systems operational',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Health check failed',
        timestamp: new Date().toISOString(),
        details: { error: error.message }
      };
    }
  }

  async getDetailedHealthStatus(): Promise<{
    application: HealthCheck;
    database: DatabaseHealthCheck;
    environment: any;
    system: any;
  }> {
    const timestamp = new Date().toISOString();
    
    try {
      const [dbCheck] = await Promise.allSettled([
        this.checkDatabaseConnection()
      ]);

      const databaseResult = dbCheck.status === 'fulfilled' ? dbCheck.value : {
        status: 'unhealthy' as const,
        message: 'Database check failed',
        timestamp,
        details: { error: dbCheck.reason?.message }
      };

      const applicationStatus: HealthCheck = {
        status: databaseResult.status === 'healthy' ? 'healthy' : 'unhealthy',
        message: databaseResult.status === 'healthy' ? 'Application is running properly' : 'Application has issues',
        timestamp
      };

      return {
        application: applicationStatus,
        database: databaseResult,
        environment: this.getEnvironmentInfo(),
        system: this.getSystemInfo()
      };
    } catch (error) {
      return {
        application: {
          status: 'unhealthy',
          message: 'Detailed health check failed',
          timestamp,
          details: { error: error.message }
        },
        database: {
          status: 'unhealthy',
          message: 'Unable to check database',
          timestamp
        },
        environment: this.getEnvironmentInfo(),
        system: this.getSystemInfo()
      };
    }
  }

  private async checkDatabaseConnection(): Promise<DatabaseHealthCheck> {
    const startTime = Date.now();
    
    try {
      // Test basic connection
      await this.prisma.$queryRaw`SELECT 1`;
      
      const connectionTime = Date.now() - startTime;

      // Get record counts for basic health metrics
      const [orgCount, userCount, toolCount, flowCount] = await Promise.all([
        this.prisma.organization.count(),
        this.prisma.user.count(),
        this.prisma.tool.count(),
        this.prisma.flow.count()
      ]);

      return {
        status: 'healthy',
        message: 'Database connection successful',
        timestamp: new Date().toISOString(),
        connectionTime,
        recordCounts: {
          organizations: orgCount,
          users: userCount,
          tools: toolCount,
          flows: flowCount
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Database connection failed',
        timestamp: new Date().toISOString(),
        connectionTime: Date.now() - startTime,
        details: { error: error.message }
      };
    }
  }

  private getEnvironmentInfo() {
    return {
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
      platform: process.platform,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      hasAwsSecrets: process.env.USE_AWS_SECRETS === 'true',
      hasDatabase: !!process.env.DATABASE_URL,
      port: process.env.PORT || 3000
    };
  }

  private getSystemInfo() {
    const now = new Date();
    return {
      timestamp: now.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      version: process.env.npm_package_version || '1.0.0',
      deployment: {
        platform: process.env.VERCEL ? 'Vercel' : 'Local',
        region: process.env.VERCEL_REGION || 'local',
        url: process.env.VERCEL_URL || 'localhost'
      }
    };
  }
}