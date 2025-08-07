import { createParamDecorator, ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import { TenantContext } from '../interfaces/tenant-context.interface';

export const Tenant = createParamDecorator(
  (data: keyof TenantContext | undefined, ctx: ExecutionContext): TenantContext | string => {
    const request = ctx.switchToHttp().getRequest();
    
    // Try to get tenant from multiple locations to handle Express/Fastify differences
    let tenant: TenantContext = request.tenant;
    
    // If not found, check the raw property (Fastify)
    if (!tenant && request.raw) {
      tenant = request.raw.tenant;
    }
    
    // If still not found, try accessing the original request object
    if (!tenant && (request as any).logContext) {
      const logContext = (request as any).logContext;
      tenant = {
        orgId: logContext.orgId,
        userId: logContext.userId,
      };
    }

    if (!tenant) {
      throw new InternalServerErrorException(
        'Tenant context not found. Ensure TenantMiddleware is applied correctly.'
      );
    }

    return data ? tenant[data] : tenant;
  },
);
