import { PartialType } from '@nestjs/swagger';
import { CreateMistakeRecordDto } from './create-mistake-record.dto';

export class UpdateMistakeRecordDto extends PartialType(CreateMistakeRecordDto) {}
