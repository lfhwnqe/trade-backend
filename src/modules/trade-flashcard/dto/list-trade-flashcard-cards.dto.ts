import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  TRADE_FLASHCARD_CARD_SORT_BY_VALUES,
  TRADE_FLASHCARD_CARD_SORT_ORDER_VALUES,
  TRADE_FLASHCARD_STATUS_VALUES,
  TRADE_FLASHCARD_TYPE_VALUES,
  TradeFlashcardCardSortBy,
  TradeFlashcardCardSortOrder,
  TradeFlashcardStatus,
  TradeFlashcardType,
} from '../trade-flashcard.types';

export class ListTradeFlashcardCardsDto {
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

  @ApiPropertyOptional({ enum: TRADE_FLASHCARD_TYPE_VALUES })
  @IsOptional()
  @IsIn(TRADE_FLASHCARD_TYPE_VALUES)
  tradeFlashcardType?: TradeFlashcardType;

  @ApiPropertyOptional({ enum: TRADE_FLASHCARD_STATUS_VALUES })
  @IsOptional()
  @IsIn(TRADE_FLASHCARD_STATUS_VALUES)
  status?: TradeFlashcardStatus;

  @ApiPropertyOptional({ description: '币对信息（模糊匹配）', example: 'BTC/USDT' })
  @IsOptional()
  @IsString()
  symbolPairInfo?: string;

  @ApiPropertyOptional({ description: '剧本类型编码（精确匹配，来自 playbook_type）', example: 'pullback_continuation' })
  @IsOptional()
  @IsString()
  playbookType?: string;

  @ApiPropertyOptional({ description: '行情时间信息（模糊匹配）', example: '2026-04-10' })
  @IsOptional()
  @IsString()
  marketTimeInfo?: string;

  @ApiPropertyOptional({ enum: TRADE_FLASHCARD_CARD_SORT_BY_VALUES, default: 'CREATED_AT' })
  @IsOptional()
  @IsIn(TRADE_FLASHCARD_CARD_SORT_BY_VALUES)
  sortBy?: TradeFlashcardCardSortBy;

  @ApiPropertyOptional({ enum: TRADE_FLASHCARD_CARD_SORT_ORDER_VALUES, default: 'desc' })
  @IsOptional()
  @IsIn(TRADE_FLASHCARD_CARD_SORT_ORDER_VALUES)
  sortOrder?: TradeFlashcardCardSortOrder;
}
