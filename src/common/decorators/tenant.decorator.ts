import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenantContext } from '../interfaces/tenant-context.interface';

export const Tenant = createParamDecorator(
  (data: keyof TenantContext | undefined, ctx: ExecutionContext): TenantContext | string => {
    const request = ctx.switchToHttp().getRequest();
    const tenant: TenantContext = request.tenant;

    if (!tenant) {
      throw new Error('Tenant context not found. Ensure TenantMiddleware is applied.');
    }

    return data ? tenant[data] : tenant;
  },
);