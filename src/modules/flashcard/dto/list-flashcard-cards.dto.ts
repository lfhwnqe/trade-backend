import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import {
  FLASHCARD_CONTEXT_VALUES,
  FLASHCARD_DIRECTION_VALUES,
  FLASHCARD_ORDER_FLOW_FEATURE_VALUES,
  FLASHCARD_RESULT_VALUES,
  FlashcardContext,
  FlashcardDirection,
  FlashcardOrderFlowFeature,
  FlashcardResult,
} from '../flashcard.types';

export class ListFlashcardCardsDto {
  @ApiPropertyOptional({ example: 20, default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @ApiPropertyOptional({
    description: '分页游标，由上一次查询返回的 nextCursor 透传',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ enum: FLASHCARD_DIRECTION_VALUES })
  @IsOptional()
  @IsIn(FLASHCARD_DIRECTION_VALUES)
  direction?: FlashcardDirection;

  @ApiPropertyOptional({ enum: FLASHCARD_CONTEXT_VALUES })
  @IsOptional()
  @IsIn(FLASHCARD_CONTEXT_VALUES)
  context?: FlashcardContext;

  @ApiPropertyOptional({ enum: FLASHCARD_ORDER_FLOW_FEATURE_VALUES })
  @IsOptional()
  @IsIn(FLASHCARD_ORDER_FLOW_FEATURE_VALUES)
  orderFlowFeature?: FlashcardOrderFlowFeature;

  @ApiPropertyOptional({ enum: FLASHCARD_RESULT_VALUES })
  @IsOptional()
  @IsIn(FLASHCARD_RESULT_VALUES)
  result?: FlashcardResult;
}
