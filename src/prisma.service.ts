import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { AwsSecretsService } from './aws-secrets.service';

// Dynamic Prisma client with runtime configuration
class DynamicPrismaClient extends PrismaClient {
  constructor(databaseUrl?: string) {
    const isProduction = process.env.NODE_ENV === 'production';
    super({
      datasources: {
        db: {
          url: databaseUrl || process.env.DATABASE_URL,
        },
      },
      log: isProduction ? ['error', 'warn'] : ['error', 'warn', 'info'],
    });
  }
}

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private useSecretsManager: boolean;
  private prismaClient: DynamicPrismaClient;
  private isInitialized = false;

  constructor(
    private readonly awsSecretsService: AwsSecretsService,
    private readonly configService: ConfigService,
    @InjectPinoLogger(PrismaService.name)
    private readonly logger: PinoLogger,
  ) {
    // Check if we should use AWS Secrets Manager (enabled by default in production)
    const nodeEnv = this.configService.get('NODE_ENV');
    const useAwsSecretsRaw = this.configService.get('USE_AWS_SECRETS', 'false');
    const useAwsSecrets = useAwsSecretsRaw?.toLowerCase() === 'true';

    this.useSecretsManager = nodeEnv === 'production' || useAwsSecrets;

    this.logger.info(
      { useSecretsManager: this.useSecretsManager, nodeEnv },
      'Prisma service initialized',
    );
  }

  async onModuleInit(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      let databaseUrl: string;

      if (this.useSecretsManager) {
        const secretName = this.configService.get('AWS_SECRET_NAME', 'tolstoy/env');
        this.logger.info({ secretName }, 'Using AWS Secrets Manager for database credentials');

        // Validate secret access first
        const canAccessSecret = await this.awsSecretsService.validateSecretAccess(secretName);
        if (!canAccessSecret) {
          throw new Error(`Cannot access AWS secret: ${secretName}`);
        }

        // Get database URL from AWS Secrets Manager with retry
        databaseUrl = await this.awsSecretsService.getDatabaseUrl(secretName);

        if (!databaseUrl) {
          throw new Error(`DATABASE_URL not found in secret: ${secretName}`);
        }

        // Validate the database URL format
        if (!databaseUrl.startsWith('postgresql://')) {
          throw new Error(`Invalid DATABASE_URL format: ${databaseUrl.substring(0, 20)}...`);
        }

        this.logger.info(
          { databaseUrlLength: databaseUrl.length },
          'Database URL retrieved from AWS Secrets Manager',
        );
      } else {
        this.logger.info('Using local environment variables for database credentials');
        databaseUrl = this.configService.get('DATABASE_URL') || '';

        if (!databaseUrl) {
          throw new Error('DATABASE_URL environment variable not found');
        }
      }

      // Create Prisma client with the database URL
      this.prismaClient = new DynamicPrismaClient(databaseUrl);

      // Test the connection
      await this.prismaClient.$connect();

      // Verify connection with a simple query
      await this.prismaClient.$queryRaw`SELECT 1 as test`;

      const connectionType = this.useSecretsManager ? 'AWS Secrets Manager' : 'local environment';
      this.logger.info(
        { connectionType, isInitialized: true },
        'Successfully connected to Neon DB',
      );

      this.isInitialized = true;
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          useSecretsManager: this.useSecretsManager,
        },
        'Failed to initialize database connection',
      );

      // If we're using secrets manager, try falling back to env vars
      if (this.useSecretsManager && !this.isInitialized) {
        this.logger.warn('Attempting fallback to environment variables');
        try {
          const fallbackUrl = this.configService.get('DATABASE_URL');
          if (fallbackUrl) {
            this.prismaClient = new DynamicPrismaClient(fallbackUrl);
            await this.prismaClient.$connect();
            await this.prismaClient.$queryRaw`SELECT 1 as test`;
            this.logger.info('Fallback connection successful using environment variables');
            this.isInitialized = true;
            return;
          }
        } catch (fallbackError) {
          this.logger.error(
            { error: fallbackError instanceof Error ? fallbackError.message : 'Unknown error' },
            'Fallback connection also failed',
          );
        }
      }

      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.prismaClient) {
      await this.prismaClient.$disconnect();
      this.logger.info('Disconnected from Prisma');
    }
  }

  // Proxy all Prisma client methods
  get $connect() {
    return (
      this.prismaClient?.$connect.bind(this.prismaClient) ||
      (() => Promise.reject(new Error('Prisma client not initialized')))
    );
  }

  get $disconnect() {
    return this.prismaClient?.$disconnect.bind(this.prismaClient) || (() => Promise.resolve());
  }

  get $queryRaw() {
    return (
      this.prismaClient?.$queryRaw.bind(this.prismaClient) ||
      (() => Promise.reject(new Error('Prisma client not initialized')))
    );
  }

  get $executeRaw() {
    return (
      this.prismaClient?.$executeRaw.bind(this.prismaClient) ||
      (() => Promise.reject(new Error('Prisma client not initialized')))
    );
  }

  get $transaction() {
    return (
      this.prismaClient?.$transaction.bind(this.prismaClient) ||
      (() => Promise.reject(new Error('Prisma client not initialized')))
    );
  }

  // Proxy all model accessors
  get organization() {
    return this.prismaClient?.organization;
  }

  get user() {
    return this.prismaClient?.user;
  }

  get tool() {
    return this.prismaClient?.tool;
  }

  get action() {
    return this.prismaClient?.action;
  }

  get flow() {
    return this.prismaClient?.flow;
  }

  get executionLog() {
    return this.prismaClient?.executionLog;
  }

  get actionExecutionLog() {
    return this.prismaClient?.actionExecutionLog;
  }

  get webhook() {
    return this.prismaClient?.webhook;
  }

  get webhookDispatchLog() {
    return this.prismaClient?.webhookDispatchLog;
  }

  get toolAuthConfig() {
    return this.prismaClient?.toolAuthConfig;
  }

  get userCredential() {
    return this.prismaClient?.userCredential;
  }

  // Health check method
  async isHealthy(): Promise<boolean> {
    try {
      if (!this.isInitialized || !this.prismaClient) {
        return false;
      }
      await this.prismaClient.$queryRaw`SELECT 1 as health_check`;
      return true;
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'Database health check failed',
      );
      return false;
    }
  }
}
