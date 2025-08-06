import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
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

    // Attach tenant context to request
    req.tenant = {
      orgId: orgId.toString(),
      userId: userId.toString(),
    };

    next();
  }
}