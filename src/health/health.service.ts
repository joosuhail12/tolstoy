import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RedisCacheService } from '../cache/redis-cache.service';

export interface HealthCheck {
  status: 'healthy' | 'unhealthy' | 'ok';
  message?: string;
  timestamp: string;
  uptime?: number;
  version?: string;
  details?: Record<string, unknown>;
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisCache: RedisCacheService,
  ) {}

  async getHealthStatus(): Promise<HealthCheck> {
    try {
      const dbCheck = await this.checkDatabaseConnection();

      if (dbCheck.status === 'unhealthy') {
        return {
          status: 'unhealthy',
          message: 'Database connection failed',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          details: { database: dbCheck },
        };
      }

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Health check failed',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  async getDetailedHealthStatus(): Promise<{
    status: string;
    database: DatabaseHealthCheck;
    redis: HealthCheck;
    environment: Record<string, unknown>;
    system: Record<string, unknown>;
  }> {
    const timestamp = new Date().toISOString();

    try {
      const [dbCheck, redisCheck] = await Promise.allSettled([
        this.checkDatabaseConnection(),
        this.checkRedisConnection(),
      ]);

      const databaseResult =
        dbCheck.status === 'fulfilled'
          ? dbCheck.value
          : {
              status: 'unhealthy' as const,
              message: 'Database check failed',
              timestamp,
              details: {
                error: dbCheck.reason instanceof Error ? dbCheck.reason.message : 'Unknown error',
              },
            };

      const redisResult =
        redisCheck.status === 'fulfilled'
          ? redisCheck.value
          : {
              status: 'unhealthy' as const,
              message: 'Redis check failed',
              timestamp,
              details: {
                error:
                  redisCheck.reason instanceof Error ? redisCheck.reason.message : 'Unknown error',
              },
            };

      const overallStatus =
        databaseResult.status === 'healthy' && redisResult.status === 'healthy'
          ? 'ok'
          : 'unhealthy';

      return {
        status: overallStatus,
        database: databaseResult,
        redis: redisResult,
        environment: this.getEnvironmentInfo(),
        system: this.getSystemInfo(),
      };
    } catch {
      return {
        status: 'unhealthy',
        database: {
          status: 'unhealthy',
          message: 'Unable to check database',
          timestamp,
        },
        redis: {
          status: 'unhealthy',
          message: 'Unable to check Redis',
          timestamp,
        },
        environment: this.getEnvironmentInfo(),
        system: this.getSystemInfo(),
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
        this.prisma.flow.count(),
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
          flows: flowCount,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Database connection failed',
        timestamp: new Date().toISOString(),
        connectionTime: Date.now() - startTime,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  private async checkRedisConnection(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      // Test Redis connection with a simple ping-like operation
      const testKey = 'health-check-test';
      const testValue = `health-check-${Date.now()}`;

      await this.redisCache.set(testKey, testValue, { ttl: 10 }); // 10 second TTL
      const retrievedValue = await this.redisCache.get(testKey);

      if (retrievedValue === testValue) {
        // Clean up test key
        await this.redisCache.del(testKey);

        const connectionTime = Date.now() - startTime;
        return {
          status: 'healthy',
          message: 'Redis connection successful',
          timestamp: new Date().toISOString(),
          details: {
            connectionTime,
            operation: 'set/get/del',
          },
        };
      } else {
        return {
          status: 'unhealthy',
          message: 'Redis data integrity check failed',
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Redis connection failed',
        timestamp: new Date().toISOString(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          connectionTime: Date.now() - startTime,
        },
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
      port: process.env.PORT || 3000,
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
        url: process.env.VERCEL_URL || 'localhost',
      },
    };
  }
}
