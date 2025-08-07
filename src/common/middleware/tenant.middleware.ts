import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { RequestWithTenant } from '../interfaces/tenant-context.interface';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: RequestWithTenant, res: Response, next: NextFunction): void {
    const orgId = req.headers['x-org-id'] as string;
    const userId = req.headers['x-user-id'] as string;

    if (!orgId || !userId) {
      throw new BadRequestException(
        'Missing required headers: X-Org-ID and X-User-ID are required for multi-tenant operations'
      );
    }

    // Generate or use existing request ID for traceability
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    
    // Attach request ID to request for Fastify compatibility
    (req as any).id = requestId;
    
    // Set response header for client traceability
    res.setHeader('x-request-id', requestId);

    // Attach tenant context to request
    req.tenant = {
      orgId: orgId.toString(),
      userId: userId.toString(),
    };

    // Store additional metadata for logging
    (req as any).logContext = {
      orgId: orgId.toString(),
      userId: userId.toString(),
      requestId,
    };

    next();
  }
}