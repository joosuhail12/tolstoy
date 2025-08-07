import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

@Injectable()
export class AwsSecretsService {
  private readonly logger = new Logger(AwsSecretsService.name);
  private client: SecretsManagerClient;
  private region: string;
  private secretCache = new Map<string, { value: any; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor(private configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    this.client = new SecretsManagerClient({ 
      region: this.region,
      maxAttempts: 3,
      retryMode: 'adaptive'
    });
    
    this.logger.log(`AWS Secrets Manager client initialized for region: ${this.region}`);
  }

  async getSecret(secretId: string, key?: string): Promise<string> {
    const cacheKey = `${secretId}:${key || 'full'}`;
    
    // Check cache first
    const cached = this.secretCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      this.logger.debug(`Using cached secret: ${cacheKey}`);
      return cached.value;
    }

    try {
      this.logger.log(`Retrieving secret: ${secretId}${key ? ` (key: ${key})` : ''}`);
      
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
            this.logger.log(`Successfully retrieved secret: ${secretId}`);
          } else {
            // Parse JSON and extract specific key
            const secrets = JSON.parse(response.SecretString);
            
            if (!secrets.hasOwnProperty(key)) {
              throw new Error(`Key '${key}' not found in secret ${secretId}. Available keys: ${Object.keys(secrets).join(', ')}`);
            }

            resultValue = secrets[key];
            this.logger.log(`Successfully retrieved secret key: ${secretId}/${key}`);
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
            this.logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      throw lastError!;
      
    } catch (error) {
      this.logger.error(`Failed to retrieve secret ${secretId}${key ? `/${key}` : ''} after 3 attempts:`, error);
      
      // If we have a stale cached value, use it as fallback
      const staleCache = this.secretCache.get(cacheKey);
      if (staleCache) {
        this.logger.warn(`Using stale cached value for ${cacheKey} due to error`);
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
      this.logger.error(`Failed to parse secret ${secretId} as JSON:`, error);
      throw error;
    }
  }

  async getDatabaseUrl(secretId: string = 'conductor-db-secret'): Promise<string> {
    return this.getSecret(secretId, 'DATABASE_URL');
  }

  async getDatabaseDirectUrl(secretId: string = 'conductor-db-secret'): Promise<string> {
    return this.getSecret(secretId, 'DIRECT_URL');
  }

  async validateSecretAccess(secretId: string): Promise<boolean> {
    try {
      await this.getSecret(secretId);
      return true;
    } catch (error) {
      this.logger.error(`Cannot access secret ${secretId}:`, error);
      return false;
    }
  }

  clearCache(): void {
    this.secretCache.clear();
    this.logger.log('Secret cache cleared');
  }
}