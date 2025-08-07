import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AwsSecretsService } from '../aws-secrets.service';
import { InputValidatorService } from './services/input-validator.service';
import { LoggingContextService } from './services/logging-context.service';

@Global()
@Module({
  providers: [PrismaService, AwsSecretsService, InputValidatorService, LoggingContextService],
  exports: [PrismaService, AwsSecretsService, InputValidatorService, LoggingContextService],
})
export class CommonModule {}