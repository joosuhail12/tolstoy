import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

export interface WebhookPayload {
  eventType: string;
  timestamp: number;
  data: any;
  metadata?: {
    orgId: string;
    webhookId: string;
    deliveryId: string;
  };
}

export interface WebhookHeaders {
  'x-webhook-signature'?: string;
  'x-webhook-timestamp'?: string;
  'x-webhook-event'?: string;
  'x-webhook-delivery'?: string;
}

@Injectable()
export class WebhookSignatureService {
  private readonly SIGNATURE_ALGORITHM = 'sha256';
  private readonly SIGNATURE_PREFIX = 'sha256=';
  private readonly TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

  generateSignature(payload: any, secret: string): string {
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);

    const signature = crypto
      .createHmac(this.SIGNATURE_ALGORITHM, secret)
      .update(payloadString)
      .digest('hex');

    return `${this.SIGNATURE_PREFIX}${signature}`;
  }

  verifySignature(payload: any, signature: string, secret: string): boolean {
    if (!signature || !secret) {
      return false;
    }

    const expectedSignature = this.generateSignature(payload, secret);

    // Ensure both buffers have the same length for timing-safe comparison
    if (signature.length !== expectedSignature.length) {
      return false;
    }

    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  }

  generateWebhookHeaders(eventType: string, payload: any, secret?: string): WebhookHeaders {
    const timestamp = Date.now();
    const deliveryId = this.generateDeliveryId();

    const headers: WebhookHeaders = {
      'x-webhook-event': eventType,
      'x-webhook-timestamp': timestamp.toString(),
      'x-webhook-delivery': deliveryId,
    };

    if (secret) {
      const payloadWithTimestamp = {
        timestamp,
        ...payload,
      };
      headers['x-webhook-signature'] = this.generateSignature(payloadWithTimestamp, secret);
    }

    return headers;
  }

  verifyWebhookRequest(
    body: any,
    headers: WebhookHeaders,
    secret: string,
  ): { valid: boolean; error?: string } {
    if (!headers['x-webhook-signature']) {
      return { valid: false, error: 'Missing signature header' };
    }

    if (!headers['x-webhook-timestamp']) {
      return { valid: false, error: 'Missing timestamp header' };
    }

    const timestamp = parseInt(headers['x-webhook-timestamp'], 10);

    if (isNaN(timestamp)) {
      return { valid: false, error: 'Invalid timestamp format' };
    }

    // Check timestamp to prevent replay attacks
    const currentTime = Date.now();
    if (Math.abs(currentTime - timestamp) > this.TIMESTAMP_TOLERANCE_MS) {
      return {
        valid: false,
        error: 'Timestamp outside of tolerance window (possible replay attack)',
      };
    }

    // Verify signature with timestamp included
    const payloadWithTimestamp = {
      timestamp,
      ...body,
    };

    const isValid = this.verifySignature(
      payloadWithTimestamp,
      headers['x-webhook-signature'],
      secret,
    );

    if (!isValid) {
      return { valid: false, error: 'Invalid signature' };
    }

    return { valid: true };
  }

  generateDeliveryId(): string {
    return `whd_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  createWebhookPayload(
    eventType: string,
    data: any,
    metadata?: {
      orgId: string;
      webhookId: string;
    },
  ): WebhookPayload {
    const deliveryId = this.generateDeliveryId();

    return {
      eventType,
      timestamp: Date.now(),
      data,
      metadata: metadata
        ? {
            ...metadata,
            deliveryId,
          }
        : undefined,
    };
  }

  hashSecret(secret: string): string {
    return crypto.createHash('sha256').update(secret).digest('hex');
  }

  generateWebhookSecret(): string {
    return `whsec_${crypto.randomBytes(24).toString('hex')}`;
  }

  isValidWebhookUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);

      // Only allow http/https protocols
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return false;
      }

      // Don't allow localhost in production
      if (process.env.NODE_ENV === 'production') {
        const hostname = parsedUrl.hostname.toLowerCase();
        if (
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname.startsWith('192.168.') ||
          hostname.startsWith('10.') ||
          hostname.endsWith('.local')
        ) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }
}
