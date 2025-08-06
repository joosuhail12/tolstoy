import { Module } from '@nestjs/common';
import { FlowsController } from './flows.controller';
import { FlowsService } from './flows.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [FlowsController],
  providers: [FlowsService, PrismaService],
  exports: [FlowsService],
})
export class FlowsModule {}