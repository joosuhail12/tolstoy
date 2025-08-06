import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

@Injectable()
export class AwsSecretsService {
  private readonly logger = new Logger(AwsSecretsService.name);
  private client: SecretsManagerClient;
  private region: string;

  constructor(private configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    this.client = new SecretsManagerClient({ 
      region: this.region,
      // AWS SDK will automatically use credentials from environment, IAM role, or AWS profile
    });
    
    this.logger.log(`AWS Secrets Manager client initialized for region: ${this.region}`);
  }

  async getSecret(secretId: string, key?: string): Promise<string> {
    try {
      this.logger.log(`Retrieving secret: ${secretId}${key ? ` (key: ${key})` : ''}`);
      
      const command = new GetSecretValueCommand({ SecretId: secretId });
      const response = await this.client.send(command);
      
      if (!response.SecretString) {
        throw new Error(`Secret ${secretId} has no SecretString value`);
      }

      // If no specific key is requested, return the entire secret string
      if (!key) {
        this.logger.log(`Successfully retrieved secret: ${secretId}`);
        return response.SecretString;
      }

      // Parse JSON and extract specific key
      const secrets = JSON.parse(response.SecretString);
      
      if (!secrets.hasOwnProperty(key)) {
        throw new Error(`Key '${key}' not found in secret ${secretId}`);
      }

      this.logger.log(`Successfully retrieved secret key: ${secretId}/${key}`);
      return secrets[key];
      
    } catch (error) {
      this.logger.error(`Failed to retrieve secret ${secretId}${key ? `/${key}` : ''}:`, error);
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

  async getDatabaseUrl(secretId: string = 'tolstoy-db-secret'): Promise<string> {
    return this.getSecret(secretId, 'DATABASE_URL');
  }

  async getDatabaseDirectUrl(secretId: string = 'tolstoy-db-secret'): Promise<string> {
    return this.getSecret(secretId, 'DIRECT_URL');
  }
}