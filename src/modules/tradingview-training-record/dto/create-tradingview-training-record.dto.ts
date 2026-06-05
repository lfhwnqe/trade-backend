import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from 'class-validator';
import {
  TRADINGVIEW_TRAINING_RECORD_RESULT_VALUES,
  TradingViewTrainingRecordResult,
} from '../tradingview-training-record.types';

export class CreateTradingViewTrainingRecordDto {
  @ApiPropertyOptional({ example: 'BTCUSDC' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  symbolPair?: string;

  @ApiProperty({ example: 'https://cdn.example.com/tradingview-training-records/u1/2026-06-05/record.png' })
  @IsString()
  @IsUrl()
  imageUrl: string;

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
