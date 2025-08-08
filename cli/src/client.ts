import { TolstoyClient as SDK } from '@joosuhail/tolstoy-sdk';

export interface ClientConfig {
  apiUrl?: string;
  apiKey?: string;
  orgId?: string;
  userId?: string;
}

export class TolstoyClient {
  private client: SDK;

  constructor(config?: ClientConfig) {
    const apiUrl = config?.apiUrl || process.env.TOLSTOY_API_URL || 'http://localhost:3000';
    const apiKey = config?.apiKey || process.env.TOLSTOY_API_KEY;
    const orgId = config?.orgId || process.env.TOLSTOY_ORG_ID;
    const userId = config?.userId || process.env.TOLSTOY_USER_ID;

    if (!apiKey) {
      throw new Error(
        'API key is required. Set TOLSTOY_API_KEY environment variable or provide it via --api-key option.'
      );
    }

    this.client = new SDK(apiUrl, orgId, userId, apiKey);
  }

  /**
   * Create a new flow from template
   */
  async createFlow(orgId: string, flowData: any) {
    try {
      return await this.client.raw.flows.flowsControllerCreate({
        name: flowData.name,
        description: flowData.description,
        steps: flowData.steps,
        trigger: flowData.trigger,
        schedule: flowData.schedule,
        inputs: flowData.inputs || [],
        metadata: {
          source: 'template',
          templateVersion: flowData.version,
          importedAt: new Date().toISOString()
        }
      });
    } catch (error) {
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
      return await this.client.raw.organizations.organizationsControllerFindAll();
    } catch (error) {
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
      return await this.client.raw.organizations.organizationsControllerFindOne(orgId);
    } catch (error) {
      if (error.response) {
        throw new Error(`API Error (${error.response.status}): ${error.response.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * List flows in organization
   */
  async listFlows(orgId?: string) {
    try {
      return await this.client.listFlows();
    } catch (error) {
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
      const response = await this.client.raw.health.healthControllerGetStatus();
      return response;
    } catch (error) {
      if (error.response) {
        throw new Error(`Connection failed (${error.response.status}): ${error.response.data?.message || error.message}`);
      }
      throw new Error(`Connection failed: ${error.message}`);
    }
  }
}