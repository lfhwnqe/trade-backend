import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { FlashcardController } from './flashcard.controller';
import { FlashcardService } from './flashcard.service';
import { DictionaryModule } from '../dictionary/dictionary.module';
import { MistakeModule } from '../mistake/mistake.module';

@Module({
  imports: [CommonModule, DictionaryModule, MistakeModule],
  controllers: [FlashcardController],
  providers: [FlashcardService],
  exports: [FlashcardService],
})
export class FlashcardModule {}
