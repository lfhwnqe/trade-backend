import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUrl, MaxLength, ValidateIf } from 'class-validator';
import {
  IMAGE_RECOGNITION_FLASHCARD_SAMPLE_RESULT_VALUES,
  IMAGE_RECOGNITION_FLASHCARD_STATUS_VALUES,
  ImageRecognitionFlashcardSampleResult,
  ImageRecognitionFlashcardStatus,
} from '../image-recognition-flashcard.types';

export class UpdateImageRecognitionFlashcardCardDto {
  @ApiPropertyOptional({ example: 'https://cdn.example.com/image-recognition-flashcards/u1/2026-06-03/card.png' })
  @IsOptional()
  @IsString()
  @ValidateIf((_, value) => value !== '')
  @IsUrl()
  imageUrl?: string;

  @ApiPropertyOptional({ example: 'image-recognition-flashcards/u1/2026-06-03/card.png' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageKey?: string;

  @ApiPropertyOptional({ example: 'range_breakout', description: '来自 playbook_type 分类的剧本编码' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  playbookType?: string;

  @ApiPropertyOptional({ enum: IMAGE_RECOGNITION_FLASHCARD_SAMPLE_RESULT_VALUES })
  @IsOptional()
  @IsString()
  @IsIn(IMAGE_RECOGNITION_FLASHCARD_SAMPLE_RESULT_VALUES)
  sampleResult?: ImageRecognitionFlashcardSampleResult;

  @ApiPropertyOptional({ example: '补充识别记忆点。空字符串表示清空备注。' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ enum: IMAGE_RECOGNITION_FLASHCARD_STATUS_VALUES })
  @IsOptional()
  @IsString()
  @IsIn(IMAGE_RECOGNITION_FLASHCARD_STATUS_VALUES)
  status?: ImageRecognitionFlashcardStatus;
}
