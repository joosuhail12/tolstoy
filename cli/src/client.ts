import { TolstoyClient as SDK } from '@joosuhail/tolstoy-sdk';

export interface ClientConfig {
  apiUrl?: string;
  baseURL?: string;
  apiKey?: string;
  token?: string;
  orgId?: string;
  userId?: string;
}

export class TolstoyClient {
  private client: SDK;

  constructor(config?: ClientConfig) {
    const apiUrl = config?.apiUrl || config?.baseURL || process.env.TOLSTOY_API_URL || 'http://localhost:3000';
    const apiKey = config?.apiKey || config?.token || process.env.TOLSTOY_API_KEY;
    const orgId = config?.orgId || process.env.TOLSTOY_ORG_ID;
    const userId = config?.userId || process.env.TOLSTOY_USER_ID;

    if (!apiKey) {
      throw new Error(
        'API key is required. Set TOLSTOY_API_KEY environment variable or provide it via --api-key option.'
      );
    }

    this.client = new SDK(apiUrl, orgId, userId, apiKey);
  }

  // Direct access to SDK methods
  get raw() {
    return this.client.raw;
  }

  /**
   * Create a new flow from template
   */
  async createFlow(orgIdOrFlowData: string | any, flowData?: any) {
    try {
      // Handle both signatures: createFlow(orgId, flowData) and createFlow(flowData)
      const data = flowData || orgIdOrFlowData;
      
      return await this.client.createFlow({
        name: data.name,
        description: data.description,
        steps: data.steps,
        triggers: data.triggers || (data.trigger ? [data.trigger] : []),
        active: data.active !== false,
        settings: data.settings,
        inputs: data.inputs || [],
        metadata: {
          source: 'template',
          templateVersion: data.version,
          importedAt: new Date().toISOString(),
          ...data.metadata
        }
      });
    } catch (error: any) {
      if (error.response) {
        throw new Error(`API Error (${error.response.status}): ${error.response.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * List organizations
   */
  async listOrganizations() {
    try {
      return await this.client.raw.organizations.list();
    } catch (error: any) {
      if (error.response) {
        throw new Error(`API Error (${error.response.status}): ${error.response.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get organization by ID
   */
  async getOrganization(orgId: string) {
    try {
      return await this.client.raw.organizations.retrieve(orgId);
    } catch (error: any) {
      if (error.response) {
        throw new Error(`API Error (${error.response.status}): ${error.response.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * List flows
   */
  async listFlows(orgId?: string) {
    try {
      return await this.client.listFlows();
    } catch (error: any) {
      if (error.response) {
        throw new Error(`API Error (${error.response.status}): ${error.response.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get flow by ID
   */
  async getFlow(flowId: string) {
    try {
      return await this.client.getFlow(flowId);
    } catch (error: any) {
      if (error.response) {
        throw new Error(`API Error (${error.response.status}): ${error.response.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Update flow
   */
  async updateFlow(flowId: string, data: any) {
    try {
      return await this.client.updateFlow(flowId, data);
    } catch (error: any) {
      if (error.response) {
        throw new Error(`API Error (${error.response.status}): ${error.response.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Delete flow
   */
  async deleteFlow(flowId: string) {
    try {
      return await this.client.deleteFlow(flowId);
    } catch (error: any) {
      if (error.response) {
        throw new Error(`API Error (${error.response.status}): ${error.response.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Execute flow with authentication
   */
  async runFlowWithAuth(flowId: string, inputs: any, options?: any) {
    try {
      return await this.client.runFlowWithAuth(flowId, inputs, options);
    } catch (error: any) {
      if (error.response) {
        throw new Error(`API Error (${error.response.status}): ${error.response.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get flow execution
   */
  async getFlowExecution(flowId: string, executionId: string) {
    try {
      return await this.client.getFlowExecution(flowId, executionId);
    } catch (error: any) {
      if (error.response) {
        throw new Error(`API Error (${error.response.status}): ${error.response.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * List tools
   */
  async listTools() {
    try {
      return await this.client.listTools();
    } catch (error: any) {
      if (error.response) {
        throw new Error(`API Error (${error.response.status}): ${error.response.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get tool by ID
   */
  async getTool(toolId: string) {
    try {
      return await this.client.getTool(toolId);
    } catch (error: any) {
      if (error.response) {
        throw new Error(`API Error (${error.response.status}): ${error.response.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Create tool
   */
  async createTool(data: any) {
    try {
      return await this.client.createTool(data);
    } catch (error: any) {
      if (error.response) {
        throw new Error(`API Error (${error.response.status}): ${error.response.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Update tool
   */
  async updateTool(toolId: string, data: any) {
    try {
      return await this.client.updateTool(toolId, data);
    } catch (error: any) {
      if (error.response) {
        throw new Error(`API Error (${error.response.status}): ${error.response.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Delete tool
   */
  async deleteTool(toolId: string) {
    try {
      return await this.client.deleteTool(toolId);
    } catch (error: any) {
      if (error.response) {
        throw new Error(`API Error (${error.response.status}): ${error.response.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get tool authentication config
   */
  async getToolAuth(toolId: string) {
    try {
      return await this.client.getToolAuth(toolId);
    } catch (error: any) {
      if (error.response) {
        throw new Error(`API Error (${error.response.status}): ${error.response.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * List webhooks
   */
  async listWebhooks() {
    try {
      return await this.client.listWebhooks();
    } catch (error: any) {
      if (error.response) {
        throw new Error(`API Error (${error.response.status}): ${error.response.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get webhook by ID
   */
  async getWebhook(webhookId: string) {
    try {
      return await this.client.getWebhook(webhookId);
    } catch (error: any) {
      if (error.response) {
        throw new Error(`API Error (${error.response.status}): ${error.response.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Create webhook
   */
  async createWebhook(data: any) {
    try {
      return await this.client.createWebhook(data);
    } catch (error: any) {
      if (error.response) {
        throw new Error(`API Error (${error.response.status}): ${error.response.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Update webhook
   */
  async updateWebhook(webhookId: string, data: any) {
    try {
      return await this.client.updateWebhook(webhookId, data);
    } catch (error: any) {
      if (error.response) {
        throw new Error(`API Error (${error.response.status}): ${error.response.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(webhookId: string) {
    try {
      return await this.client.deleteWebhook(webhookId);
    } catch (error: any) {
      if (error.response) {
        throw new Error(`API Error (${error.response.status}): ${error.response.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Test connection to API
   */
  async testConnection() {
    try {
      const response = await this.client.raw.health.check();
      return response;
    } catch (error: any) {
      if (error.response) {
        throw new Error(`Connection failed (${error.response.status}): ${error.response.data?.message || error.message}`);
      }
      throw new Error(`Connection failed: ${error.message}`);
    }
  }
}