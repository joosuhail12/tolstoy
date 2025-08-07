import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { 
  SecretsManagerClient, 
  GetSecretValueCommand, 
  PutSecretValueCommand,
  CreateSecretCommand,
  DescribeSecretCommand,
  DeleteSecretCommand,
  ResourceNotFoundException 
} from '@aws-sdk/client-secrets-manager';

@Injectable()
export class AwsSecretsService {
  private client: SecretsManagerClient;
  private region: string;
  private secretCache = new Map<string, { value: any; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor(
    private configService: ConfigService,
    @InjectPinoLogger(AwsSecretsService.name)
    private readonly logger: PinoLogger,
  ) {

    this.region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    this.client = new SecretsManagerClient({ 
      region: this.region,
      maxAttempts: 3,
      retryMode: 'adaptive'
    });
    
    this.logger.info({ region: this.region }, 'AWS Secrets Manager client initialized');
  }

  async getSecret(secretId: string, key?: string): Promise<string> {
    const cacheKey = `${secretId}:${key || 'full'}`;
    
    // Check cache first
    const cached = this.secretCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      this.logger.debug({ secretId, key, cached: true }, 'Using cached secret');
      return cached.value;
    }

    try {
      this.logger.info({ secretId, key }, 'Retrieving secret from AWS');
      
      // Add retry logic with exponential backoff
      let lastError: Error;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const command = new GetSecretValueCommand({ SecretId: secretId });
          const response = await this.client.send(command);
          
          if (!response.SecretString) {
            throw new Error(`Secret ${secretId} has no SecretString value`);
          }

          let resultValue: string;

          // If no specific key is requested, return the entire secret string
          if (!key) {
            resultValue = response.SecretString;
            this.logger.info({ secretId, fromCache: false }, 'Successfully retrieved secret');
          } else {
            // Parse JSON and extract specific key
            const secrets = JSON.parse(response.SecretString);
            
            if (!secrets.hasOwnProperty(key)) {
              throw new Error(`Key '${key}' not found in secret ${secretId}. Available keys: ${Object.keys(secrets).join(', ')}`);
            }

            resultValue = secrets[key];
            this.logger.info({ secretId, key, fromCache: false }, 'Successfully retrieved secret key');
          }

          // Cache the result
          this.secretCache.set(cacheKey, {
            value: resultValue,
            timestamp: Date.now()
          });

          return resultValue;

        } catch (error) {
          lastError = error as Error;
          if (attempt < 3) {
            const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
            this.logger.warn({ secretId, key, attempt, delay, error: error.message }, 'Secret retrieval failed, retrying');
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      throw lastError!;
      
    } catch (error) {
      this.logger.error({ secretId, key, error: error.message, attempts: 3 }, 'Failed to retrieve secret after all attempts');
      
      // If we have a stale cached value, use it as fallback
      const staleCache = this.secretCache.get(cacheKey);
      if (staleCache) {
        this.logger.warn({ secretId, key, cached: true, stale: true }, 'Using stale cached value due to error');
        return staleCache.value;
      }
      
      throw error;
    }
  }

  async getSecretAsJson(secretId: string): Promise<Record<string, any>> {
    try {
      const secretString = await this.getSecret(secretId);
      return JSON.parse(secretString);
    } catch (error) {
      this.logger.error({ secretId, error: error.message }, 'Failed to parse secret as JSON');
      throw error;
    }
  }

  async getDatabaseUrl(secretId: string = 'conductor-db-secret'): Promise<string> {
    return this.getSecret(secretId, 'DATABASE_URL');
  }

  async getDatabaseDirectUrl(secretId: string = 'conductor-db-secret'): Promise<string> {
    return this.getSecret(secretId, 'DIRECT_URL');
  }

  async getDaytonaApiKey(secretId: string = 'conductor-db-secret'): Promise<string> {
    return this.getSecret(secretId, 'DAYTONA_API_KEY');
  }

  async getDaytonaBaseUrl(secretId: string = 'conductor-db-secret'): Promise<string> {
    return this.getSecret(secretId, 'DAYTONA_BASE_URL');
  }

  async getDaytonaSyncTimeout(secretId: string = 'conductor-db-secret'): Promise<string> {
    return this.getSecret(secretId, 'DAYTONA_SYNC_TIMEOUT');
  }

  async getDaytonaAsyncTimeout(secretId: string = 'conductor-db-secret'): Promise<string> {
    return this.getSecret(secretId, 'DAYTONA_ASYNC_TIMEOUT');
  }

  async getInngestApiKey(secretId: string = 'tolstoy/env'): Promise<string> {
    return this.getSecret(secretId, 'INNGEST_API_KEY');
  }

  async getInngestWebhookSecret(secretId: string = 'tolstoy/env'): Promise<string> {
    return this.getSecret(secretId, 'INNGEST_WEBHOOK_SECRET');
  }

  async getInngestConfig(secretId: string = 'tolstoy/env'): Promise<{
    apiKey: string;
    webhookSecret: string;
  }> {
    const secrets = await this.getSecretAsJson(secretId);
    return {
      apiKey: secrets.INNGEST_API_KEY,
      webhookSecret: secrets.INNGEST_WEBHOOK_SECRET,
    };
  }

  async validateSecretAccess(secretId: string): Promise<boolean> {
    try {
      await this.getSecret(secretId);
      return true;
    } catch (error) {
      this.logger.error({ secretId, error: error.message }, 'Cannot access secret');
      return false;
    }
  }

  async updateSecret(secretId: string, secretValue: string | Record<string, any>): Promise<void> {
    try {
      this.logger.info({ secretId }, 'Updating secret value');

      const secretString = typeof secretValue === 'string' 
        ? secretValue 
        : JSON.stringify(secretValue);

      const command = new PutSecretValueCommand({
        SecretId: secretId,
        SecretString: secretString
      });

      await this.client.send(command);
      
      // Clear cache for this secret
      const keysToRemove = Array.from(this.secretCache.keys())
        .filter(key => key.startsWith(secretId));
      keysToRemove.forEach(key => this.secretCache.delete(key));

      this.logger.info({ secretId }, 'Successfully updated secret');
    } catch (error) {
      this.logger.error({ secretId, error: error.message }, 'Failed to update secret');
      throw error;
    }
  }

  async createSecret(secretName: string, secretValue: string | Record<string, any>, description?: string): Promise<void> {
    try {
      this.logger.info({ secretName, description }, 'Creating new secret');

      const secretString = typeof secretValue === 'string' 
        ? secretValue 
        : JSON.stringify(secretValue);

      const command = new CreateSecretCommand({
        Name: secretName,
        SecretString: secretString,
        Description: description
      });

      await this.client.send(command);
      this.logger.info({ secretName }, 'Successfully created secret');
    } catch (error) {
      this.logger.error({ secretName, error: error.message }, 'Failed to create secret');
      throw error;
    }
  }

  async secretExists(secretId: string): Promise<boolean> {
    try {
      const command = new DescribeSecretCommand({ SecretId: secretId });
      await this.client.send(command);
      return true;
    } catch (error) {
      if (error instanceof ResourceNotFoundException) {
        return false;
      }
      throw error;
    }
  }

  async updateSecretKey(secretId: string, key: string, value: string): Promise<void> {
    try {
      const existingSecret = await this.getSecretAsJson(secretId);
      existingSecret[key] = value;
      await this.updateSecret(secretId, existingSecret);
      this.logger.info({ secretId, key }, 'Successfully updated secret key');
    } catch (error) {
      this.logger.error({ secretId, key, error: error.message }, 'Failed to update secret key');
      throw error;
    }
  }

  async deleteSecret(secretId: string, forceDelete: boolean = false): Promise<void> {
    try {
      this.logger.info({ secretId, forceDelete }, 'Deleting secret');

      const command = new DeleteSecretCommand({
        SecretId: secretId,
        ForceDeleteWithoutRecovery: forceDelete
      });

      await this.client.send(command);
      
      // Clear cache for this secret
      const keysToRemove = Array.from(this.secretCache.keys())
        .filter(key => key.startsWith(secretId));
      keysToRemove.forEach(key => this.secretCache.delete(key));

      this.logger.info({ secretId }, 'Successfully deleted secret');
    } catch (error) {
      if (error instanceof ResourceNotFoundException) {
        this.logger.warn({ secretId }, 'Secret not found, may already be deleted');
        return; // Don't throw error if secret doesn't exist
      }
      this.logger.error({ secretId, error: error.message }, 'Failed to delete secret');
      throw error;
    }
  }

  clearCache(): void {
    this.secretCache.clear();
    this.logger.info({ cacheSize: this.secretCache.size }, 'Secret cache cleared');
  }
}