import { Module } from '@nestjs/common';
import { ToolSecretsService } from './tool-secrets.service';
import { ToolSecretsController, ToolSecretsListController } from './tool-secrets.controller';
import { PrismaService } from '../prisma.service';
import { AwsSecretsService } from '../aws-secrets.service';

@Module({
  controllers: [ToolSecretsController, ToolSecretsListController],
  providers: [ToolSecretsService, PrismaService, AwsSecretsService],
  exports: [ToolSecretsService],
})
export class ToolSecretsModule {}