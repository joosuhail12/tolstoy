// Global setup for smoke tests
beforeAll(() => {
  // Ensure required environment variables are present
  const requiredEnvs = ['SMOKE_API_URL'];
  
  for (const env of requiredEnvs) {
    if (!process.env[env]) {
      throw new Error(`Missing required environment variable: ${env}`);
    }
  }

  // Set default timeout for all tests
  jest.setTimeout(60000);
});

// Global test configuration
expect.extend({
  toBeHealthy(received: any) {
    const pass = received.status === 200 && received.body?.status === 'ok';
    if (pass) {
      return {
        message: () => `expected ${received.status} not to be a healthy response`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received.status} to be a healthy response, got ${JSON.stringify(received.body)}`,
        pass: false,
      };
    }
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeHealthy(): R;
    }
  }
}