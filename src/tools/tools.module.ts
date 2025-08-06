import { Module } from '@nestjs/common';
import { ToolsController } from './tools.controller';
import { ToolsService } from './tools.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ToolsController],
  providers: [ToolsService, PrismaService],
  exports: [ToolsService],
})
export class ToolsModule {}