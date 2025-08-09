import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DaytonaService } from './daytona.service';
import { AwsSecretsService } from '../aws-secrets.service';

@Module({
  imports: [ConfigModule],
  providers: [DaytonaService, AwsSecretsService],
  exports: [DaytonaService],
})
export class DaytonaModule {}
