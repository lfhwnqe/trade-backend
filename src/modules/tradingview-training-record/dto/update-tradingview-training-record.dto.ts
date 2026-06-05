import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from 'class-validator';
import {
  TRADINGVIEW_TRAINING_RECORD_RESULT_VALUES,
  TradingViewTrainingRecordResult,
} from '../tradingview-training-record.types';

export class UpdateTradingViewTrainingRecordDto {
  @ApiPropertyOptional({ example: 'BTCUSDT' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  symbolPair?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/tradingview-training-records/u1/2026-06-05/record.png' })
  @IsOptional()
  @IsString()
  @IsUrl()
  imageUrl?: string;

  @ApiPropertyOptional({ example: 'tradingview-training-records/u1/2026-06-05/record.png' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageKey?: string;

  @ApiPropertyOptional({ enum: TRADINGVIEW_TRAINING_RECORD_RESULT_VALUES })
  @IsOptional()
  @IsString()
  @IsIn(TRADINGVIEW_TRAINING_RECORD_RESULT_VALUES)
  tradeResult?: TradingViewTrainingRecordResult;

  @ApiPropertyOptional({ example: 'range_breakout' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  playbookType?: string;

  @ApiPropertyOptional({ example: 4, minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  entryConfidenceRating?: 1 | 2 | 3 | 4 | 5;

  @ApiPropertyOptional({ example: '复盘备注。' })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  notes?: string;

  @ApiPropertyOptional({ example: '2026-06-05T12:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  reviewCandleTime?: string | null;
}
