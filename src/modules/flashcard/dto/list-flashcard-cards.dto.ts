import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import {
  FLASHCARD_BEHAVIOR_TYPE_VALUES,
  FLASHCARD_INVALIDATION_TYPE_VALUES,
  FlashcardBehaviorType,
  FlashcardInvalidationType,
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

  @ApiPropertyOptional({ enum: FLASHCARD_BEHAVIOR_TYPE_VALUES })
  @IsOptional()
  @IsIn(FLASHCARD_BEHAVIOR_TYPE_VALUES)
  behaviorType?: FlashcardBehaviorType;

  @ApiPropertyOptional({ enum: FLASHCARD_INVALIDATION_TYPE_VALUES })
  @IsOptional()
  @IsIn(FLASHCARD_INVALIDATION_TYPE_VALUES)
  invalidationType?: FlashcardInvalidationType;

  @ApiPropertyOptional({ description: '币对信息（模糊匹配）', example: 'BTC/USDT' })
  @IsOptional()
  @IsString()
  symbolPairInfo?: string;

  @ApiPropertyOptional({
    description: '行情时间信息（模糊匹配）',
    example: '2026-03-05',
  })
  @IsOptional()
  @IsString()
  marketTimeInfo?: string;
}
