import { PartialType } from '@nestjs/mapped-types';
import { CreateExecutionLogDto } from './create-execution-log.dto';

export class UpdateExecutionLogDto extends PartialType(CreateExecutionLogDto) {}
