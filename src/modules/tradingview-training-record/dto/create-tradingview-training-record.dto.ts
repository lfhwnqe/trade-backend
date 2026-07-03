import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
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
import {
  TRADINGVIEW_TRAINING_RECORD_RESULT_VALUES,
  TradingViewTrainingRecordResult,
} from '../tradingview-training-record.types';

export class TradingViewTrainingRecordImageItemDto {
  @ApiProperty({ example: 'https://cdn.example.com/tradingview-training-records/u1/2026-07-03/analysis-start/record.png' })
  @IsString()
  @IsUrl()
  imageUrl: string;

  @ApiPropertyOptional({ example: 'tradingview-training-records/u1/2026-07-03/analysis-start/record.png' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageKey?: string;

  @ApiPropertyOptional({ example: '分析开始时，价格在区间上沿附近等待二次确认。' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remark?: string;
}

export class CreateTradingViewTrainingRecordDto {
  @ApiPropertyOptional({ example: 'BTCUSDC' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  symbolPair?: string;

  @ApiProperty({ type: [TradingViewTrainingRecordImageItemDto], description: '分析开始时图片，至少 1 张' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TradingViewTrainingRecordImageItemDto)
  analysisStartImages: TradingViewTrainingRecordImageItemDto[];

  @ApiPropertyOptional({ type: [TradingViewTrainingRecordImageItemDto], description: '分析后走势图片，可为空，可多张' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TradingViewTrainingRecordImageItemDto)
  postAnalysisTrendImages?: TradingViewTrainingRecordImageItemDto[];

  @ApiProperty({ type: [TradingViewTrainingRecordImageItemDto], description: '挂单图片，至少 1 张' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TradingViewTrainingRecordImageItemDto)
  pendingOrderImages: TradingViewTrainingRecordImageItemDto[];

  @ApiProperty({ type: [TradingViewTrainingRecordImageItemDto], description: '离场时图片，至少 1 张' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TradingViewTrainingRecordImageItemDto)
  exitImages: TradingViewTrainingRecordImageItemDto[];

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

  @ApiProperty({ enum: TRADINGVIEW_TRAINING_RECORD_RESULT_VALUES, example: 'WIN' })
  @IsString()
  @IsIn(TRADINGVIEW_TRAINING_RECORD_RESULT_VALUES)
  tradeResult: TradingViewTrainingRecordResult;

  @ApiProperty({ example: 'range_breakout', description: '来自 playbook_type 分类的剧本编码' })
  @IsString()
  @MaxLength(100)
  playbookType: string;

  @ApiProperty({ example: 4, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  entryConfidenceRating: 1 | 2 | 3 | 4 | 5;

  @ApiPropertyOptional({ example: '入场二次确认足够清晰，但离场略慢。' })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  notes?: string;

  @ApiPropertyOptional({ example: '2026-06-05T12:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  reviewCandleTime?: string;
}
