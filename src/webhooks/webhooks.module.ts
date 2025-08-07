import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhookSignatureService } from './webhook-signature.service';
import { DispatchWebhookModule } from './dispatch-webhook.module';

@Module({
  imports: [DispatchWebhookModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookSignatureService],
  exports: [WebhooksService, WebhookSignatureService, DispatchWebhookModule],
})
export class WebhooksModule {}
