import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DispatchWebhookHandler } from './dispatch-webhook.handler';
import { WebhooksService } from './webhooks.service';
import { WebhookSignatureService } from './webhook-signature.service';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 3,
      validateStatus: status => status < 500, // Don't throw on 4xx errors, let handler decide
    }),
  ],
  providers: [DispatchWebhookHandler, WebhooksService, WebhookSignatureService, PrismaService],
  exports: [DispatchWebhookHandler],
})
export class DispatchWebhookModule {}
