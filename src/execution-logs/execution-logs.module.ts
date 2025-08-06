import { Module } from '@nestjs/common';
import { ExecutionLogsController } from './execution-logs.controller';
import { ExecutionLogsService } from './execution-logs.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ExecutionLogsController],
  providers: [ExecutionLogsService, PrismaService],
  exports: [ExecutionLogsService],
})
export class ExecutionLogsModule {}