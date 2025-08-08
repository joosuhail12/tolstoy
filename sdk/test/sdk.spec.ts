import { TolstoyClient } from '../src/index';

describe('TolstoyClient', () => {
  let client: TolstoyClient;

  beforeEach(() => {
    client = new TolstoyClient(
      'https://api.tolstoy.io',
      'org-123',
      'user-456',
      'fake-token'
    );
  });

  it('should create a client instance', () => {
    expect(client).toBeInstanceOf(TolstoyClient);
  });

  it('should have access to raw API', () => {
    expect(client.raw).toBeDefined();
    expect(client.raw.flows).toBeDefined();
    expect(client.raw.tools).toBeDefined();
    expect(client.raw.webhooks).toBeDefined();
  });

  it('should have helper methods', () => {
    expect(typeof client.runFlow).toBe('function');
    expect(typeof client.listFlows).toBe('function');
    expect(typeof client.createTool).toBe('function');
    expect(typeof client.listTools).toBe('function');
    expect(typeof client.createWebhook).toBe('function');
    expect(typeof client.listWebhooks).toBe('function');
  });
});