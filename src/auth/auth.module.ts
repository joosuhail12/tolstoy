import { Module } from '@nestjs/common';
import { AuthConfigService } from './auth-config.service';
import { PrismaService } from '../prisma.service';
import { AwsSecretsService } from '../aws-secrets.service';
import { RedisCacheService } from '../cache/redis-cache.service';

@Module({
  providers: [
    AuthConfigService,
    PrismaService,
    AwsSecretsService,
    RedisCacheService,
  ],
  exports: [AuthConfigService],
})
export class AuthModule {}