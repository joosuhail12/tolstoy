import { TolstoyAPI, type ClientOptions } from '../generated/client';
import { APIPromise } from '../generated/core/api-promise';

export interface TolstoyClientConfig extends ClientOptions {
  orgId?: string;
  userId?: string;
  token?: string;
}

// Type definitions for common API responses
export interface FlowExecution {
  id: string;
  flowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  variables: Record<string, any>;
  results?: Record<string, any>;
  error?: string;
}

export interface Tool {
  id: string;
  name: string;
  description?: string;
  version?: string;
  actions: Action[];
  createdAt: string;
  updatedAt: string;
}

export interface Action {
  id: string;
  name: string;
  description?: string;
  inputSchema: InputParam[] | Record<string, any>;
  outputSchema?: Record<string, any>;
  toolId: string;
  createdAt: string;
  updatedAt: string;
}

export interface InputParam {
  name: string;
  label?: string;
  description?: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'date';
  required: boolean;
  control?: 'text' | 'number' | 'checkbox' | 'select' | 'date-picker' | 'textarea';
  options?: string[];
  default?: any;
  visibleIf?: any; // JSONLogic condition
  validation?: ValidationConstraints;
  ui?: UIMetadata;
}

export interface ValidationConstraints {
  min?: number;
  max?: number;
  pattern?: string;
  format?: string;
}

export interface UIMetadata {
  placeholder?: string;
  helpText?: string;
  width?: 'full' | 'half' | 'quarter';
  order?: number;
}

export interface AuthConfig {
  id: string;
  toolId: string;
  orgId: string;
  type: 'apiKey' | 'oauth2';
  config: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  secret?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Flow {
  id: string;
  name: string;
  description?: string;
  steps: FlowStep[];
  triggers: FlowTrigger[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FlowStep {
  id: string;
  type: string;
  name: string;
  config: Record<string, any>;
  dependencies?: string[];
}

export interface FlowTrigger {
  id: string;
  type: 'webhook' | 'schedule' | 'manual';
  config: Record<string, any>;
}

export class TolstoyClient {
  private api: TolstoyAPI;

  constructor(config: TolstoyClientConfig | string, orgId?: string, userId?: string, token?: string) {
    // Support both object config and legacy string baseUrl
    if (typeof config === 'string') {
      // Legacy constructor support
      const clientOptions: ClientOptions = {
        baseURL: config,
        orgID: orgId || 'default-org', // Provide fallback orgID
        userID: userId,
        defaultHeaders: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
        }
      };
      this.api = new TolstoyAPI(clientOptions);
    } else {
      // New config object constructor
      const clientOptions: ClientOptions = {
        ...config,
        orgID: config.orgId || 'default-org', // Provide fallback orgID
        userID: config.userId,
        defaultHeaders: {
          ...config.defaultHeaders,
          ...(config.token && { 'Authorization': `Bearer ${config.token}` }),
        }
      };
      this.api = new TolstoyAPI(clientOptions);
    }
  }

  // === Core Flow Methods ===
  async runFlow(flowId: string, inputs: any, useDurable: boolean = true): Promise<any> {
    return this.api.flows.execute(flowId, {
      variables: inputs,
      useDurable,
    });
  }

  async getFlowExecution(flowId: string, executionId: string): Promise<any> {
    return this.api.flows.executions.retrieve(executionId, { id: flowId });
  }

  async listFlows(): Promise<any> {
    return this.api.flows.list();
  }

  async getFlow(flowId: string): Promise<any> {
    return this.api.flows.retrieve(flowId);
  }

  async createFlow(flowData: any): Promise<any> {
    return this.api.flows.create(flowData);
  }

  async updateFlow(flowId: string, flowData: any): Promise<any> {
    return this.api.flows.update(flowId, flowData);
  }

  async deleteFlow(flowId: string): Promise<any> {
    return this.api.flows.delete(flowId);
  }

  // === Tool Management Methods ===
  async createTool(toolData: any): Promise<any> {
    return this.api.tools.create(toolData);
  }

  async listTools(): Promise<any> {
    return this.api.tools.list();
  }

  async getTool(toolId: string): Promise<any> {
    return this.api.tools.retrieve(toolId);
  }

  async updateTool(toolId: string, toolData: any): Promise<any> {
    return this.api.tools.update(toolId, toolData);
  }

  async deleteTool(toolId: string): Promise<any> {
    return this.api.tools.delete(toolId);
  }

  // === Action Methods ===
  async listActions(): Promise<any> {
    return this.api.actions.list();
  }

  async getAction(actionId: string): Promise<any> {
    return this.api.actions.retrieve(actionId);
  }

  async createAction(actionData: any): Promise<any> {
    return this.api.actions.create(actionData);
  }

  async updateAction(actionId: string, actionData: any): Promise<any> {
    return this.api.actions.update(actionId, actionData);
  }

  async deleteAction(actionId: string): Promise<any> {
    return this.api.actions.delete(actionId);
  }

  // === Webhook Methods ===
  async createWebhook(webhookData: any): Promise<any> {
    return this.api.webhooks.create(webhookData);
  }

  async listWebhooks(): Promise<any> {
    return this.api.webhooks.list();
  }

  async getWebhook(webhookId: string): Promise<any> {
    return this.api.webhooks.retrieve(webhookId);
  }

  async updateWebhook(webhookId: string, webhookData: any): Promise<any> {
    return this.api.webhooks.update(webhookId, webhookData);
  }

  async deleteWebhook(webhookId: string): Promise<any> {
    return this.api.webhooks.delete(webhookId);
  }

  // === New Authentication Methods ===

  // Tool Authentication Configuration
  async upsertToolAuth(toolId: string, authConfig: any): Promise<any> {
    return this.api.tools.auth.upsert(toolId, authConfig);
  }

  async getToolAuth(toolId: string): Promise<any> {
    return this.api.tools.auth.retrieve(toolId);
  }

  async deleteToolAuth(toolId: string): Promise<any> {
    return this.api.tools.auth.delete(toolId);
  }

  // OAuth Flow Methods  
  async initiateOAuth(toolKey: string, redirectUri?: string, state?: string): Promise<any> {
    const query: any = {};
    if (redirectUri) query.redirect_uri = redirectUri;
    if (state) query.state = state;
    return this.api.auth.oauthLogin(toolKey, query);
  }

  async handleOAuthCallback(toolKey: string, code: string, state?: string): Promise<any> {
    const query: any = { code };
    if (state) query.state = state;
    return this.api.auth.oauthCallback(toolKey, query);
  }

  // Single Action Execution
  async executeAction(actionKey: string, inputs: any, orgId?: string): Promise<any> {
    const options: any = {};
    if (orgId) {
      options.headers = { 'x-org-id': orgId };
    }
    return this.api.actions.execute(actionKey, inputs, options);
  }

  // === Helper Methods for Enhanced Input Schema ===

  async executeActionWithValidation(
    actionKey: string, 
    inputs: any, 
    options?: {
      orgId?: string;
      skipValidation?: boolean;
      validateOnly?: boolean;
    }
  ): Promise<any> {
    const { orgId, skipValidation = false, validateOnly = false } = options || {};
    
    // Build request options with custom headers
    const requestOptions: any = {
      headers: {
        ...(orgId && { 'x-org-id': orgId }),
        ...(skipValidation && { 'x-skip-validation': 'true' }),
        ...(validateOnly && { 'x-validate-only': 'true' }),
      }
    };

    return this.api.actions.execute(actionKey, inputs, requestOptions);
  }

  // === Enhanced Flow Methods ===

  async runFlowWithAuth(
    flowId: string, 
    inputs: any, 
    options?: {
      useDurable?: boolean;
      orgId?: string;
      authOverrides?: Record<string, any>;
    }
  ): Promise<any> {
    const { useDurable = true, orgId, authOverrides } = options || {};
    
    const requestOptions: any = {};
    if (orgId) {
      requestOptions.headers = { 'x-org-id': orgId };
    }

    const payload: any = {
      variables: inputs,
      useDurable,
    };

    if (authOverrides) {
      payload.authOverrides = authOverrides;
    }

    return this.api.flows.execute(flowId, payload, requestOptions);
  }

  // Direct access to generated API for advanced usage
  get raw(): TolstoyAPI {
    return this.api;
  }
}

// Export main client and config interface
export { TolstoyClient as default };

// Re-export everything from the generated API
export * from '../generated/index';
export { TolstoyAPI } from '../generated/client';