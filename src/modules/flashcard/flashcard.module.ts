import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { FlashcardController } from './flashcard.controller';
import { FlashcardService } from './flashcard.service';
import { DictionaryModule } from '../dictionary/dictionary.module';

@Module({
  imports: [CommonModule, DictionaryModule],
  controllers: [FlashcardController],
  providers: [FlashcardService],
})
export class FlashcardModule {}
