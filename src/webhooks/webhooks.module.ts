import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhookSignatureService } from './webhook-signature.service';

@Module({
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookSignatureService],
  exports: [WebhooksService, WebhookSignatureService],
})
export class WebhooksModule {}