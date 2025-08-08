import { Module } from '@nestjs/common';
import { ActionsController } from './actions.controller';
import { ActionsService } from './actions.service';
import { CommonModule } from '../common/common.module';
import { AuthModule } from '../auth/auth.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [CommonModule, AuthModule, MetricsModule],
  controllers: [ActionsController],
  providers: [
    ActionsService,
  ],
  exports: [ActionsService],
})
export class ActionsModule {}
