import { Module } from '@nestjs/common';
import { ToolSecretsService } from './tool-secrets.service';
import { ToolSecretsController, ToolSecretsListController } from './tool-secrets.controller';

@Module({
  controllers: [ToolSecretsController, ToolSecretsListController],
  providers: [ToolSecretsService],
  exports: [ToolSecretsService],
})
export class ToolSecretsModule {}
