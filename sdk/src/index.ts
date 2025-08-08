import { Api, ApiConfig } from '../generated/TolstoyApi';

export class TolstoyClient {
  private api: Api<unknown>;

  constructor(baseUrl: string, orgId?: string, userId?: string, token?: string) {
    const config: ApiConfig = {
      baseURL: baseUrl,
      headers: {
        ...(orgId && { 'x-org-id': orgId }),
        ...(userId && { 'x-user-id': userId }),
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
    };
    this.api = new Api<unknown>(config);
  }

  // Helper methods for common operations
  async runFlow(flowId: string, inputs: any, useDurable: boolean = true) {
    return this.api.flows.flowsControllerExecuteFlow(
      flowId,
      {
        variables: inputs,
        useDurable,
      }
    );
  }

  async getFlowExecution(flowId: string, executionId: string) {
    return this.api.flows.flowsControllerGetExecutionStatus(flowId, executionId);
  }

  async listFlows() {
    return this.api.flows.flowsControllerFindAll();
  }

  async createTool(toolData: any) {
    return this.api.tools.toolsControllerCreate(toolData);
  }

  async listTools() {
    return this.api.tools.toolsControllerFindAll();
  }

  async createWebhook(webhookData: any) {
    return this.api.webhooks.webhooksControllerCreate(webhookData);
  }

  async listWebhooks() {
    return this.api.webhooks.webhooksControllerFindAll();
  }

  // Direct access to generated API for advanced usage
  get raw() {
    return this.api;
  }
}

// Re-export types from generated API
export * from '../generated/TolstoyApi';
export { TolstoyClient as default };