import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, IsUrl, MaxLength, ValidateIf, ValidateNested } from 'class-validator';
import { ImageRecognitionFlashcardImageDto } from './image-recognition-flashcard-image.dto';
import {
  IMAGE_RECOGNITION_FLASHCARD_SAMPLE_RESULT_VALUES,
  IMAGE_RECOGNITION_FLASHCARD_STATUS_VALUES,
  ImageRecognitionFlashcardSampleResult,
  ImageRecognitionFlashcardStatus,
} from '../image-recognition-flashcard.types';

export class CreateImageRecognitionFlashcardCardDto {
  @ApiPropertyOptional({ example: 'https://cdn.example.com/image-recognition-flashcards/u1/2026-06-03/card.png', description: '旧版单图字段；未传 images 时必填' })
  @ValidateIf((dto, value) => dto.images === undefined || value !== undefined)
  @IsString()
  @IsUrl()
  imageUrl?: string;

  @ApiPropertyOptional({ type: [ImageRecognitionFlashcardImageDto], minItems: 1, maxItems: 5 })
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ImageRecognitionFlashcardImageDto)
  images?: ImageRecognitionFlashcardImageDto[];

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
