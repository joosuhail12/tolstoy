import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisCacheService } from './redis-cache.service';
import { AwsSecretsService } from '../aws-secrets.service';

/**
 * Cache Module
 *
 * Provides Redis caching functionality across the application.
 * Global module - no need to import in other modules.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    RedisCacheService,
    AwsSecretsService, // Required for Redis credential resolution
  ],
  exports: [RedisCacheService],
})
export class CacheModule {}
