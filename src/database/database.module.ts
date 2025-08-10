import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AwsSecretsService } from '../aws-secrets.service';

@Global()
@Module({
  providers: [PrismaService, AwsSecretsService],
  exports: [PrismaService, AwsSecretsService],
})
export class DatabaseModule {}