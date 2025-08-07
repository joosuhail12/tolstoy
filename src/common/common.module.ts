import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AwsSecretsService } from '../aws-secrets.service';
import { InputValidatorService } from './services/input-validator.service';
import { LoggingContextService } from './services/logging-context.service';
import { ConditionEvaluatorService } from './services/condition-evaluator.service';

@Global()
@Module({
  providers: [PrismaService, AwsSecretsService, InputValidatorService, LoggingContextService, ConditionEvaluatorService],
  exports: [PrismaService, AwsSecretsService, InputValidatorService, LoggingContextService, ConditionEvaluatorService],
})
export class CommonModule {}