import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { DictionaryModule } from '../dictionary/dictionary.module';
import { TradeFlashcardController } from './trade-flashcard.controller';
import { TradeFlashcardService } from './trade-flashcard.service';

@Module({
  imports: [CommonModule, DictionaryModule],
  controllers: [TradeFlashcardController],
  providers: [TradeFlashcardService],
})
export class TradeFlashcardModule {}
