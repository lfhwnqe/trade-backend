import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import {
  IMAGE_RECOGNITION_FLASHCARD_SAMPLE_RESULT_VALUES,
  IMAGE_RECOGNITION_FLASHCARD_STATUS_VALUES,
  ImageRecognitionFlashcardSampleResult,
  ImageRecognitionFlashcardStatus,
} from '../image-recognition-flashcard.types';

export class CreateImageRecognitionFlashcardCardDto {
  @ApiProperty({ example: 'https://cdn.example.com/image-recognition-flashcards/u1/2026-06-03/card.png' })
  @IsString()
  @IsUrl()
  imageUrl: string;

  @ApiPropertyOptional({ example: 'image-recognition-flashcards/u1/2026-06-03/card.png' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageKey?: string;

  @ApiProperty({ example: 'range_breakout', description: '来自 playbook_type 分类的剧本编码' })
  @IsString()
  @MaxLength(100)
  playbookType: string;

  @ApiProperty({ enum: IMAGE_RECOGNITION_FLASHCARD_SAMPLE_RESULT_VALUES, example: 'SUCCESS' })
  @IsString()
  @IsIn(IMAGE_RECOGNITION_FLASHCARD_SAMPLE_RESULT_VALUES)
  sampleResult: ImageRecognitionFlashcardSampleResult;

  @ApiPropertyOptional({ example: '注意突破后的回踩质量和二次确认。' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ enum: IMAGE_RECOGNITION_FLASHCARD_STATUS_VALUES, default: 'ACTIVE' })
  @IsOptional()
  @IsString()
  @IsIn(IMAGE_RECOGNITION_FLASHCARD_STATUS_VALUES)
  status?: ImageRecognitionFlashcardStatus;
}
