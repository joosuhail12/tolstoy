import { Module } from '@nestjs/common';
import { AuthConfigService } from './auth-config.service';
import { OAuthService } from './oauth.service';
import { RedisCacheService } from '../cache/redis-cache.service';
import { ToolAuthController } from './tool-auth.controller';
import { OAuthController } from './oauth.controller';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [MetricsModule],
  providers: [AuthConfigService, OAuthService, RedisCacheService],
  exports: [AuthConfigService, OAuthService],
  controllers: [ToolAuthController, OAuthController],
})
export class AuthModule {}
