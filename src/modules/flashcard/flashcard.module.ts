import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { FlashcardController } from './flashcard.controller';
import { FlashcardService } from './flashcard.service';

@Module({
  imports: [CommonModule],
  controllers: [FlashcardController],
  providers: [FlashcardService],
})
export class FlashcardModule {}
