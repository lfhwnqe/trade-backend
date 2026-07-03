import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { TradingViewTrainingRecordImageItemDto } from './create-tradingview-training-record.dto';
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

  @ApiPropertyOptional({ type: [TradingViewTrainingRecordImageItemDto], description: '分析开始时图片，触碰过程图片组时至少 1 张' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TradingViewTrainingRecordImageItemDto)
  analysisStartImages?: TradingViewTrainingRecordImageItemDto[];

  @ApiPropertyOptional({ type: [TradingViewTrainingRecordImageItemDto], description: '分析后走势图片，可为空，可多张' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TradingViewTrainingRecordImageItemDto)
  postAnalysisTrendImages?: TradingViewTrainingRecordImageItemDto[];

  @ApiPropertyOptional({ type: [TradingViewTrainingRecordImageItemDto], description: '挂单图片，触碰过程图片组时至少 1 张' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TradingViewTrainingRecordImageItemDto)
  pendingOrderImages?: TradingViewTrainingRecordImageItemDto[];

  @ApiPropertyOptional({ type: [TradingViewTrainingRecordImageItemDto], description: '离场时图片，触碰过程图片组时至少 1 张' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TradingViewTrainingRecordImageItemDto)
  exitImages?: TradingViewTrainingRecordImageItemDto[];

  @ApiPropertyOptional({ type: [TradingViewTrainingRecordImageItemDto], description: '离场后走势图片，可为空，可多张' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TradingViewTrainingRecordImageItemDto)
  postExitTrendImages?: TradingViewTrainingRecordImageItemDto[];

  @ApiPropertyOptional({ example: 'https://cdn.example.com/tradingview-training-records/u1/2026-06-05/record.png', description: '历史兼容单图字段' })
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
