import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { DictionaryModule } from '../dictionary/dictionary.module';
import { MistakeController } from './mistake.controller';
import { MistakeService } from './mistake.service';

@Module({
  imports: [CommonModule, DictionaryModule],
  controllers: [MistakeController],
  providers: [MistakeService],
  exports: [MistakeService],
})
export class MistakeModule {}
