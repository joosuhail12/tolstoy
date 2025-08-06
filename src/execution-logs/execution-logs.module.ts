import { Module } from '@nestjs/common';
import { ExecutionLogsController } from './execution-logs.controller';
import { ExecutionLogsService } from './execution-logs.service';

@Module({
  controllers: [ExecutionLogsController],
  providers: [ExecutionLogsService],
  exports: [ExecutionLogsService],
})
export class ExecutionLogsModule {}