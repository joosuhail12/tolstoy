import { TolstoyClient } from '../src/client';

// Mock the SDK
jest.mock('@joosuhail/tolstoy-sdk', () => ({
  TolstoyClient: jest.fn().mockImplementation(() => ({
    raw: {
      flows: {
        flowsControllerCreate: jest.fn(),
      },
      organizations: {
        organizationsControllerFindAll: jest.fn(),
        organizationsControllerFindOne: jest.fn(),
      },
      health: {
        healthControllerGetStatus: jest.fn(),
      },
    },
    listFlows: jest.fn(),
  })),
}));

describe('TolstoyClient', () => {
  let client: TolstoyClient;
  let mockSDK: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock environment variables
    process.env.TOLSTOY_API_KEY = 'test-api-key';
    process.env.TOLSTOY_API_URL = 'http://test-api.local';
    
    client = new TolstoyClient();
    mockSDK = (client as any).client;
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.TOLSTOY_API_KEY;
    delete process.env.TOLSTOY_API_URL;
  });

  describe('constructor', () => {
    it('should create client with environment variables', () => {
      const client = new TolstoyClient();
      expect(client).toBeInstanceOf(TolstoyClient);
    });

    it('should create client with config options', () => {
      const client = new TolstoyClient({
        apiUrl: 'http://custom.api',
        apiKey: 'custom-key',
        orgId: 'org-123',
        userId: 'user-456'
      });
      expect(client).toBeInstanceOf(TolstoyClient);
    });

    it('should throw error without API key', () => {
      delete process.env.TOLSTOY_API_KEY;
      
      expect(() => new TolstoyClient()).toThrow(
        'API key is required. Set TOLSTOY_API_KEY environment variable or provide it via --api-key option.'
      );
    });

    it('should use default API URL when not provided', () => {
      delete process.env.TOLSTOY_API_URL;
      
      const client = new TolstoyClient({ apiKey: 'test-key' });
      expect(client).toBeInstanceOf(TolstoyClient);
    });
  });

  describe('createFlow', () => {
    it('should create flow with template data', async () => {
      const mockResponse = {
        data: {
          id: 'flow-123',
          name: 'Test Flow',
          description: 'Test description'
        }
      };
      
      mockSDK.raw.flows.flowsControllerCreate.mockResolvedValue(mockResponse);
      
      const flowData = {
        name: 'Test Flow',
        description: 'Test description',
        version: 1,
        steps: [{ key: 'step1', action: 'test' }]
      };
      
      const result = await client.createFlow('org-123', flowData);
      
      expect(mockSDK.raw.flows.flowsControllerCreate).toHaveBeenCalledWith({
        name: 'Test Flow',
        description: 'Test description',
        steps: [{ key: 'step1', action: 'test' }],
        trigger: undefined,
        schedule: undefined,
        inputs: [],
        metadata: {
          source: 'template',
          templateVersion: 1,
          importedAt: expect.any(String)
        }
      });
      
      expect(result).toEqual(mockResponse);
    });

    it('should handle API errors', async () => {
      const mockError = {
        response: {
          status: 400,
          data: { message: 'Validation failed' }
        }
      };
      
      mockSDK.raw.flows.flowsControllerCreate.mockRejectedValue(mockError);
      
      await expect(client.createFlow('org-123', { name: 'Test' }))
        .rejects.toThrow('API Error (400): Validation failed');
    });

    it('should handle network errors', async () => {
      const mockError = new Error('Network error');
      mockSDK.raw.flows.flowsControllerCreate.mockRejectedValue(mockError);
      
      await expect(client.createFlow('org-123', { name: 'Test' }))
        .rejects.toThrow('Network error');
    });
  });

  describe('listOrganizations', () => {
    it('should list organizations', async () => {
      const mockResponse = {
        data: [
          { id: 'org-1', name: 'Org 1' },
          { id: 'org-2', name: 'Org 2' }
        ]
      };
      
      mockSDK.raw.organizations.organizationsControllerFindAll.mockResolvedValue(mockResponse);
      
      const result = await client.listOrganizations();
      
      expect(mockSDK.raw.organizations.organizationsControllerFindAll).toHaveBeenCalled();
      expect(result).toEqual(mockResponse);
    });

    it('should handle API errors', async () => {
      const mockError = {
        response: {
          status: 401,
          data: { message: 'Unauthorized' }
        }
      };
      
      mockSDK.raw.organizations.organizationsControllerFindAll.mockRejectedValue(mockError);
      
      await expect(client.listOrganizations())
        .rejects.toThrow('API Error (401): Unauthorized');
    });
  });

  describe('getOrganization', () => {
    it('should get organization by ID', async () => {
      const mockResponse = {
        data: { id: 'org-123', name: 'Test Org' }
      };
      
      mockSDK.raw.organizations.organizationsControllerFindOne.mockResolvedValue(mockResponse);
      
      const result = await client.getOrganization('org-123');
      
      expect(mockSDK.raw.organizations.organizationsControllerFindOne)
        .toHaveBeenCalledWith('org-123');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('listFlows', () => {
    it('should list flows', async () => {
      const mockResponse = {
        data: [
          { id: 'flow-1', name: 'Flow 1' },
          { id: 'flow-2', name: 'Flow 2' }
        ]
      };
      
      mockSDK.listFlows.mockResolvedValue(mockResponse);
      
      const result = await client.listFlows();
      
      expect(mockSDK.listFlows).toHaveBeenCalled();
      expect(result).toEqual(mockResponse);
    });
  });

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      const mockResponse = {
        data: { status: 'ok' }
      };
      
      mockSDK.raw.health.healthControllerGetStatus.mockResolvedValue(mockResponse);
      
      const result = await client.testConnection();
      
      expect(mockSDK.raw.health.healthControllerGetStatus).toHaveBeenCalled();
      expect(result).toEqual(mockResponse);
    });

    it('should handle connection errors', async () => {
      const mockError = {
        response: {
          status: 500,
          data: { message: 'Internal server error' }
        }
      };
      
      mockSDK.raw.health.healthControllerGetStatus.mockRejectedValue(mockError);
      
      await expect(client.testConnection())
        .rejects.toThrow('Connection failed (500): Internal server error');
    });

    it('should handle network errors', async () => {
      const mockError = new Error('ECONNREFUSED');
      mockSDK.raw.health.healthControllerGetStatus.mockRejectedValue(mockError);
      
      await expect(client.testConnection())
        .rejects.toThrow('Connection failed: ECONNREFUSED');
    });
  });
});