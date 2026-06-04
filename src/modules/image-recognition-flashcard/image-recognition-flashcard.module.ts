import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { DictionaryModule } from '../dictionary/dictionary.module';
import { ImageRecognitionFlashcardController } from './image-recognition-flashcard.controller';
import { ImageRecognitionFlashcardService } from './image-recognition-flashcard.service';

@Module({
  imports: [CommonModule, DictionaryModule],
  controllers: [ImageRecognitionFlashcardController],
  providers: [ImageRecognitionFlashcardService],
  exports: [ImageRecognitionFlashcardService],
})
export class ImageRecognitionFlashcardModule {}
