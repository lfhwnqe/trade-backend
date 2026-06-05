import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  TRADINGVIEW_TRAINING_RECORD_RESULT_VALUES,
  TRADINGVIEW_TRAINING_RECORD_SORT_BY_VALUES,
  TRADINGVIEW_TRAINING_RECORD_SORT_ORDER_VALUES,
  TradingViewTrainingRecordResult,
  TradingViewTrainingRecordSortBy,
  TradingViewTrainingRecordSortOrder,
} from '../tradingview-training-record.types';

export class ListTradingViewTrainingRecordsDto {
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

  @ApiPropertyOptional({ example: 'range_breakout' })
  @IsOptional()
  @IsString()
  playbookType?: string;

  @ApiPropertyOptional({ example: 'BTCUSDT' })
  @IsOptional()
  @IsString()
  symbolPair?: string;

  @ApiPropertyOptional({ enum: TRADINGVIEW_TRAINING_RECORD_RESULT_VALUES })
  @IsOptional()
  @IsIn(TRADINGVIEW_TRAINING_RECORD_RESULT_VALUES)
  tradeResult?: TradingViewTrainingRecordResult;

  @ApiPropertyOptional({ example: 4, minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  entryConfidenceRating?: 1 | 2 | 3 | 4 | 5;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-06-05T23:59:59.999Z' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ description: '备注关键词（模糊匹配）' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ enum: TRADINGVIEW_TRAINING_RECORD_SORT_BY_VALUES, default: 'CREATED_AT' })
  @IsOptional()
  @IsIn(TRADINGVIEW_TRAINING_RECORD_SORT_BY_VALUES)
  sortBy?: TradingViewTrainingRecordSortBy;

  @ApiPropertyOptional({ enum: TRADINGVIEW_TRAINING_RECORD_SORT_ORDER_VALUES, default: 'desc' })
  @IsOptional()
  @IsIn(TRADINGVIEW_TRAINING_RECORD_SORT_ORDER_VALUES)
  sortOrder?: TradingViewTrainingRecordSortOrder;
}
