import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { DictionaryModule } from '../dictionary/dictionary.module';
import { PracticalFlashcardController } from './practical-flashcard.controller';
import { PracticalFlashcardService } from './practical-flashcard.service';

@Module({
  imports: [CommonModule, DictionaryModule],
  controllers: [PracticalFlashcardController],
  providers: [PracticalFlashcardService],
})
export class PracticalFlashcardModule {}
