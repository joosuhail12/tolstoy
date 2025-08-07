import { Module } from '@nestjs/common';
import { FlowsController } from './flows.controller';
import { FlowsService } from './flows.service';
import { FlowExecutorService } from './flow-executor.service';

@Module({
  controllers: [FlowsController],
  providers: [FlowsService, FlowExecutorService],
  exports: [FlowsService, FlowExecutorService],
})
export class FlowsModule {}