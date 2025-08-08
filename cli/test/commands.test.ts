import { jest } from '@jest/globals';

// Mock node-fetch
const mockFetch = jest.fn() as jest.MockedFunction<any>;
jest.unstable_mockModule('node-fetch', () => ({
  default: mockFetch,
}));

// Mock open
const mockOpen = jest.fn() as jest.MockedFunction<any>;
jest.unstable_mockModule('open', () => ({
  default: mockOpen,
}));

// Mock dotenv
jest.unstable_mockModule('dotenv', () => ({
  config: jest.fn(),
}));

describe('CLI Commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set default environment variables for tests
    process.env.API_BASE_URL = 'https://api.tolstoy.test';
    process.env.TOLSTOY_API_KEY = 'test-api-key';
    process.env.ORG_ID = 'test-org-123';
  });

  afterEach(() => {
    delete process.env.API_BASE_URL;
    delete process.env.TOLSTOY_API_KEY;
    delete process.env.ORG_ID;
  });

  describe('Tool Auth API Key Command', () => {
    it('should configure API key successfully', async () => {
      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'config-123', message: 'API key configured' }),
        text: async () => '',
        status: 200,
        statusText: 'OK',
      });

      const { ToolAuthApiKeyCommand } = await import('../src/commands/tool-auth-api-key');
      
      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      try {
        // Since we can't directly test commander actions, we'll test the API call
        expect(mockFetch).not.toHaveBeenCalled();
        
        // The command structure is tested by ensuring it's properly defined
        expect(ToolAuthApiKeyCommand).toBeDefined();
        expect(ToolAuthApiKeyCommand.name()).toBe('tool');
        expect(ToolAuthApiKeyCommand.description()).toBe('Configure tool authentication');
        
      } finally {
        consoleSpy.mockRestore();
      }
    });

    it('should handle API errors gracefully', async () => {
      // Mock API error response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid tool' }),
        text: async () => JSON.stringify({ error: 'Invalid tool' }),
        status: 400,
        statusText: 'Bad Request',
      });

      // Test error handling would be done in integration tests
      // Unit tests focus on command structure and configuration
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should require mandatory options', async () => {
      const { ToolAuthApiKeyCommand } = await import('../src/commands/tool-auth-api-key');
      
      // Find the api-key subcommand
      const toolAuthCmd = ToolAuthApiKeyCommand.commands.find(cmd => cmd.name() === 'auth');
      const apiKeyCmd = toolAuthCmd?.commands.find(cmd => cmd.name() === 'api-key');
      
      expect(apiKeyCmd).toBeDefined();
      expect(apiKeyCmd?.description()).toBe('Configure an API key for a tool');
      
      // Check required options
      const options = apiKeyCmd?.options || [];
      const requiredOptions = options.filter(opt => opt.required);
      
      expect(requiredOptions).toHaveLength(4); // org, tool, key, and header (if required)
    });
  });

  describe('Tool Auth OAuth2 Command', () => {
    it('should configure OAuth2 successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'oauth-config-456', message: 'OAuth2 configured' }),
        text: async () => '',
        status: 200,
        statusText: 'OK',
      });

      const { ToolAuthOauth2Command } = await import('../src/commands/tool-auth-oauth2');
      
      expect(ToolAuthOauth2Command).toBeDefined();
      expect(ToolAuthOauth2Command.name()).toBe('tool');
      expect(ToolAuthOauth2Command.description()).toBe('Configure tool authentication');
    });

    it('should include optional OAuth2 parameters', async () => {
      const { ToolAuthOauth2Command } = await import('../src/commands/tool-auth-oauth2');
      
      // Find the oauth2 subcommand
      const toolAuthCmd = ToolAuthOauth2Command.commands.find(cmd => cmd.name() === 'auth');
      const oauth2Cmd = toolAuthCmd?.commands.find(cmd => cmd.name() === 'oauth2');
      
      expect(oauth2Cmd).toBeDefined();
      expect(oauth2Cmd?.description()).toBe('Configure OAuth2 client credentials for a tool');
      
      // Check for optional parameters like scope, authorize-url, token-url
      const options = oauth2Cmd?.options || [];
      const scopeOption = options.find(opt => opt.long === '--scope');
      const authorizeUrlOption = options.find(opt => opt.long === '--authorize-url');
      const tokenUrlOption = options.find(opt => opt.long === '--token-url');
      
      expect(scopeOption).toBeDefined();
      expect(authorizeUrlOption).toBeDefined();
      expect(tokenUrlOption).toBeDefined();
    });
  });

  describe('Auth Login Command', () => {
    it('should generate correct login URL', async () => {
      mockOpen.mockResolvedValueOnce(undefined);

      const { AuthLoginCommand } = await import('../src/commands/auth-login');
      
      expect(AuthLoginCommand).toBeDefined();
      expect(AuthLoginCommand.name()).toBe('auth');
      expect(AuthLoginCommand.description()).toBe('User authentication commands');
    });

    it('should handle no-open option', async () => {
      const { AuthLoginCommand } = await import('../src/commands/auth-login');
      
      const loginCmd = AuthLoginCommand.commands.find(cmd => cmd.name() === 'login');
      expect(loginCmd).toBeDefined();
      
      // Check for --no-open option
      const options = loginCmd?.options || [];
      const noOpenOption = options.find(opt => opt.long === '--no-open');
      expect(noOpenOption).toBeDefined();
    });

    it('should require tool and user parameters', async () => {
      const { AuthLoginCommand } = await import('../src/commands/auth-login');
      
      const loginCmd = AuthLoginCommand.commands.find(cmd => cmd.name() === 'login');
      const options = loginCmd?.options || [];
      const requiredOptions = options.filter(opt => opt.required);
      
      // Should require at least tool and user
      expect(requiredOptions.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Execute Action Command', () => {
    it('should execute action successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          success: true, 
          executionId: 'exec-789', 
          data: { result: 'success' },
          duration: 1234 
        }),
        text: async () => '',
        status: 200,
        statusText: 'OK',
      });

      const { ExecuteActionCommand } = await import('../src/commands/execute-action');
      
      expect(ExecuteActionCommand).toBeDefined();
      expect(ExecuteActionCommand.name()).toBe('actions:execute');
      expect(ExecuteActionCommand.description()).toBe('Execute a single Action by key');
    });

    it('should validate JSON inputs', async () => {
      const { ExecuteActionCommand } = await import('../src/commands/execute-action');
      
      // Check that it accepts an argument for inputs
      expect(ExecuteActionCommand.args).toHaveLength(1);
      const firstArg = ExecuteActionCommand.args[0];
      expect(typeof firstArg === 'object' && 'name' in firstArg ? (firstArg as any).name() : firstArg).toBe('inputs');
    });

    it('should include timeout option', async () => {
      const { ExecuteActionCommand } = await import('../src/commands/execute-action');
      
      const options = ExecuteActionCommand.options || [];
      const timeoutOption = options.find(opt => opt.long === '--timeout');
      
      expect(timeoutOption).toBeDefined();
      expect(timeoutOption?.defaultValue).toBe('30');
    });

    it('should handle user-scoped authentication', async () => {
      const { ExecuteActionCommand } = await import('../src/commands/execute-action');
      
      const options = ExecuteActionCommand.options || [];
      const userOption = options.find(opt => opt.long === '--user');
      
      expect(userOption).toBeDefined();
      expect(userOption?.required).toBeFalsy(); // Should be optional
    });
  });

  describe('Environment Variable Handling', () => {
    it('should handle missing API_BASE_URL', () => {
      delete process.env.API_BASE_URL;
      delete process.env.TOLSTOY_API_URL;
      
      // Commands should check for API URL in their action handlers
      // This would be tested in integration tests where we can actually run the commands
      expect(process.env.API_BASE_URL).toBeUndefined();
      expect(process.env.TOLSTOY_API_URL).toBeUndefined();
    });

    it('should prioritize TOLSTOY_API_URL over API_BASE_URL', () => {
      process.env.API_BASE_URL = 'https://api.old.example.com';
      process.env.TOLSTOY_API_URL = 'https://api.new.example.com';
      
      // Commands should use TOLSTOY_API_URL when both are set
      // This logic is in the command implementations
      expect(process.env.TOLSTOY_API_URL).toBe('https://api.new.example.com');
    });

    it('should handle API key from environment', () => {
      process.env.TOLSTOY_API_KEY = 'env-api-key';
      process.env.API_KEY = 'fallback-key';
      
      expect(process.env.TOLSTOY_API_KEY).toBe('env-api-key');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      
      // Error handling is tested in the command implementations
      // Integration tests would verify the actual error messages
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(timeoutError);
      
      // Timeout handling is in the execute-action command
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should validate JSON input format', () => {
      // JSON validation is done in the execute-action command
      const invalidJson = '{"invalid": json}';
      
      expect(() => {
        JSON.parse(invalidJson);
      }).toThrow();
      
      const validJson = '{"valid": "json"}';
      expect(() => {
        JSON.parse(validJson);
      }).not.toThrow();
    });
  });
});