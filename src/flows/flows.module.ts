import { Module } from '@nestjs/common';
import { FlowsController } from './flows.controller';
import { FlowsService } from './flows.service';
import { FlowExecutorService } from './flow-executor.service';
import { AblyService } from '../ably/ably.service';
import { SecretsResolver } from '../secrets/secrets-resolver.service';
import { OAuthTokenService } from '../oauth/oauth-token.service';
import { AwsSecretsService } from '../aws-secrets.service';

@Module({
  controllers: [FlowsController],
  providers: [
    FlowsService, 
    FlowExecutorService,
    AblyService,
    SecretsResolver,
    OAuthTokenService,
    AwsSecretsService
  ],
  exports: [FlowsService, FlowExecutorService],
})
export class FlowsModule {}