import { TolstoyClient, TolstoyClientConfig } from '../src/index';

describe('TolstoyClient', () => {
  let client: TolstoyClient;

  beforeEach(() => {
    client = new TolstoyClient({
      baseURL: 'https://api.tolstoy.io',
      orgId: 'org-123',
      userId: 'user-456',
      token: 'fake-token'
    });
  });

  it('should create a client instance with config object', () => {
    expect(client).toBeInstanceOf(TolstoyClient);
  });

  it('should create a client instance with legacy string parameters', () => {
    const legacyClient = new TolstoyClient(
      'https://api.tolstoy.io',
      'org-123',
      'user-456',
      'fake-token'
    );
    expect(legacyClient).toBeInstanceOf(TolstoyClient);
  });

  it('should have access to raw axios API', () => {
    expect(client.raw).toBeDefined();
    expect(typeof client.raw.get).toBe('function');
    expect(typeof client.raw.post).toBe('function');
    expect(typeof client.raw.put).toBe('function');
    expect(typeof client.raw.delete).toBe('function');
  });

  it('should have core flow helper methods', () => {
    expect(typeof client.runFlow).toBe('function');
    expect(typeof client.listFlows).toBe('function');
    expect(typeof client.getFlow).toBe('function');
    expect(typeof client.createFlow).toBe('function');
    expect(typeof client.updateFlow).toBe('function');
    expect(typeof client.deleteFlow).toBe('function');
    expect(typeof client.getFlowExecution).toBe('function');
  });

  it('should have tool management helper methods', () => {
    expect(typeof client.createTool).toBe('function');
    expect(typeof client.listTools).toBe('function');
    expect(typeof client.getTool).toBe('function');
    expect(typeof client.updateTool).toBe('function');
    expect(typeof client.deleteTool).toBe('function');
  });

  it('should have action helper methods', () => {
    expect(typeof client.listActions).toBe('function');
    expect(typeof client.getAction).toBe('function');
    expect(typeof client.createAction).toBe('function');
    expect(typeof client.updateAction).toBe('function');
    expect(typeof client.deleteAction).toBe('function');
  });

  it('should have webhook helper methods', () => {
    expect(typeof client.createWebhook).toBe('function');
    expect(typeof client.listWebhooks).toBe('function');
    expect(typeof client.getWebhook).toBe('function');
    expect(typeof client.updateWebhook).toBe('function');
    expect(typeof client.deleteWebhook).toBe('function');
  });

  it('should have new authentication helper methods', () => {
    expect(typeof client.upsertToolAuth).toBe('function');
    expect(typeof client.getToolAuth).toBe('function');
    expect(typeof client.deleteToolAuth).toBe('function');
    expect(typeof client.initiateOAuth).toBe('function');
    expect(typeof client.handleOAuthCallback).toBe('function');
  });

  it('should have single action execution methods', () => {
    expect(typeof client.executeAction).toBe('function');
    expect(typeof client.executeActionWithValidation).toBe('function');
  });

  it('should have enhanced flow methods', () => {
    expect(typeof client.runFlowWithAuth).toBe('function');
  });
});