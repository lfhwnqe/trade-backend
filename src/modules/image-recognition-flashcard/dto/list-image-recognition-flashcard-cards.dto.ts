import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  IMAGE_RECOGNITION_FLASHCARD_CARD_SORT_BY_VALUES,
  IMAGE_RECOGNITION_FLASHCARD_CARD_SORT_ORDER_VALUES,
  IMAGE_RECOGNITION_FLASHCARD_SAMPLE_RESULT_VALUES,
  IMAGE_RECOGNITION_FLASHCARD_STATUS_FILTER_VALUES,
  ImageRecognitionFlashcardCardSortBy,
  ImageRecognitionFlashcardCardSortOrder,
  ImageRecognitionFlashcardSampleResult,
  ImageRecognitionFlashcardStatusFilter,
} from '../image-recognition-flashcard.types';

export class ListImageRecognitionFlashcardCardsDto {
  @ApiPropertyOptional({ example: 20, default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @ApiPropertyOptional({ description: '分页游标，由上一次查询返回的 nextCursor 透传' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ description: '剧本类型编码（精确匹配，来自 playbook_type）', example: 'range_breakout' })
  @IsOptional()
  @IsString()
  playbookType?: string;

  @ApiPropertyOptional({ enum: IMAGE_RECOGNITION_FLASHCARD_SAMPLE_RESULT_VALUES, description: '样本结果筛选' })
  @IsOptional()
  @IsIn(IMAGE_RECOGNITION_FLASHCARD_SAMPLE_RESULT_VALUES)
  sampleResult?: ImageRecognitionFlashcardSampleResult;

  @ApiPropertyOptional({ enum: IMAGE_RECOGNITION_FLASHCARD_STATUS_FILTER_VALUES, default: 'ACTIVE' })
  @IsOptional()
  @IsIn(IMAGE_RECOGNITION_FLASHCARD_STATUS_FILTER_VALUES)
  status?: ImageRecognitionFlashcardStatusFilter;

  @ApiPropertyOptional({ description: '备注关键词（模糊匹配）', example: '二次确认' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ enum: IMAGE_RECOGNITION_FLASHCARD_CARD_SORT_BY_VALUES, default: 'CREATED_AT' })
  @IsOptional()
  @IsIn(IMAGE_RECOGNITION_FLASHCARD_CARD_SORT_BY_VALUES)
  sortBy?: ImageRecognitionFlashcardCardSortBy;

  @ApiPropertyOptional({ enum: IMAGE_RECOGNITION_FLASHCARD_CARD_SORT_ORDER_VALUES, default: 'desc' })
  @IsOptional()
  @IsIn(IMAGE_RECOGNITION_FLASHCARD_CARD_SORT_ORDER_VALUES)
  sortOrder?: ImageRecognitionFlashcardCardSortOrder;
}
