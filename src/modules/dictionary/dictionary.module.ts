import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { DictionaryController } from './dictionary.controller';
import { DictionaryService } from './dictionary.service';

@Module({
  imports: [CommonModule],
  controllers: [DictionaryController],
  providers: [DictionaryService],
  exports: [DictionaryService],
})
export class DictionaryModule {}
