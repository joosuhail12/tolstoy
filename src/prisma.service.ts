import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { AwsSecretsService } from './aws-secrets.service';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private useSecretsManager: boolean;

  constructor(
    private readonly awsSecretsService: AwsSecretsService,
    private readonly configService: ConfigService,
  ) {
    super();
    // Check if we should use AWS Secrets Manager (enabled by default in production)
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    const useAwsSecretsRaw = this.configService.get<string>('USE_AWS_SECRETS', 'false');
    const useAwsSecrets = useAwsSecretsRaw?.toLowerCase() === 'true';
    
    this.useSecretsManager = nodeEnv === 'production' || useAwsSecrets;
  }

  async onModuleInit(): Promise<void> {
    try {
      if (this.useSecretsManager) {
        this.logger.log('Using AWS Secrets Manager for database credentials...');
        
        // Get database URL from AWS Secrets Manager
        const secretName = this.configService.get<string>('AWS_SECRET_NAME', 'tolstoy-db-secret');
        const databaseUrl = await this.awsSecretsService.getDatabaseUrl(secretName);
        
        // Disconnect any existing connection
        await this.$disconnect();
        
        // Update the datasource URL
        (this as any)._engineConfig = {
          ...((this as any)._engineConfig || {}),
          datasourceOverrides: { 
            db: databaseUrl 
          }
        };
        
        this.logger.log('Database URL retrieved from AWS Secrets Manager');
      } else {
        this.logger.log('Using local environment variables for database credentials...');
      }

      // Connect to the database
      await this.$connect();
      
      const connectionType = this.useSecretsManager ? 'AWS Secrets Manager' : 'local environment';
      this.logger.log(`✅ Successfully connected to Neon DB via ${connectionType}`);
      
    } catch (error) {
      this.logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Disconnected from Prisma');
  }
}