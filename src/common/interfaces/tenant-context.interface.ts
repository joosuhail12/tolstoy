export interface TenantContext {
  orgId: string;
  userId: string;
}

export interface RequestWithTenant extends Request {
  tenant: TenantContext;
}