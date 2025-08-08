import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Response, NextFunction } from 'express';
import { IncomingHttpHeaders } from 'http';
import { randomUUID } from 'crypto';
import { RequestWithTenant } from '../interfaces/tenant-context.interface';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(
    req: RequestWithTenant & { headers: IncomingHttpHeaders },
    res: Response,
    next: NextFunction,
  ): void {
    const orgId = req.headers['x-org-id'] as string | undefined;
    const userId = req.headers['x-user-id'] as string | undefined;

    if (!orgId || !userId) {
      throw new BadRequestException(
        'Missing required headers: X-Org-ID and X-User-ID are required for multi-tenant operations',
      );
    }

    // Generate or use existing request ID for traceability
    const requestId = (req.headers['x-request-id'] as string | undefined) || randomUUID();

    // Attach request ID to request for Fastify compatibility
    (req as unknown as RequestWithTenant & { id: string }).id = requestId;

    // Set response header for client traceability
    res.setHeader('x-request-id', requestId);

    // Attach tenant context to request using multiple methods to ensure compatibility
    req.tenant = {
      orgId: orgId.toString(),
      userId: userId.toString(),
    };

    // Also set it on the raw request object for Fastify compatibility
    (req as unknown as RequestWithTenant & { raw: RequestWithTenant }).raw =
      (req as unknown as RequestWithTenant & { raw?: RequestWithTenant }).raw || req;
    (req as unknown as RequestWithTenant & { raw: RequestWithTenant }).raw.tenant = req.tenant;

    // Store additional metadata for logging
    (
      req as unknown as RequestWithTenant & {
        logContext: { orgId: string; userId: string; requestId: string };
      }
    ).logContext = {
      orgId: orgId!.toString(),
      userId: userId!.toString(),
      requestId,
    };

    next();
  }
}
