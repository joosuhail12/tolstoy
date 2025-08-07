import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AwsSecretsService } from '../aws-secrets.service';
import { InputValidatorService } from './services/input-validator.service';

@Global()
@Module({
  providers: [PrismaService, AwsSecretsService, InputValidatorService],
  exports: [PrismaService, AwsSecretsService, InputValidatorService],
})
export class CommonModule {}