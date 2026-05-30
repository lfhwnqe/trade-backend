import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import {
  PRACTICAL_FLASHCARD_INTERVAL_VALUES,
  PRACTICAL_FLASHCARD_TRADE_DIRECTION_VALUES,
  PracticalFlashcardInterval,
  PracticalFlashcardTradeDirection,
} from '../practical-flashcard.types';

export class CreatePracticalFlashcardAttemptTradeDto {
  @ApiProperty({ enum: PRACTICAL_FLASHCARD_TRADE_DIRECTION_VALUES })
  @IsIn(PRACTICAL_FLASHCARD_TRADE_DIRECTION_VALUES)
  direction: PracticalFlashcardTradeDirection;

  @ApiProperty({ description: '确认交易时当前已揭示 K 线 index' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  currentCandleIndex: number;

  @ApiPropertyOptional({ enum: PRACTICAL_FLASHCARD_INTERVAL_VALUES, description: '本次训练当前回放周期；不传时使用卡片默认周期' })
  @IsOptional()
  @IsIn(PRACTICAL_FLASHCARD_INTERVAL_VALUES)
  replayInterval?: PracticalFlashcardInterval;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  stopLossPrice: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  takeProfitPrice: number;

  @ApiPropertyOptional({ description: 'PF-M3 绘图快照' })
  @IsOptional()
  @IsObject()
  drawingSnapshot?: Record<string, unknown>;

  @ApiProperty({ description: '确认交易前的市场结构分析' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  preTradeMarketStructureAnalysis: string;

  @ApiPropertyOptional({ description: '确认交易前的价格行为分析' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  preTradePriceActionAnalysis?: string;

  @ApiPropertyOptional({ description: '确认交易前的足迹图 / 订单流分析' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  preTradeOrderFlowAnalysis?: string;
}
