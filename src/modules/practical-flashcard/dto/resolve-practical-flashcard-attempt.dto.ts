import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PRACTICAL_FLASHCARD_EXIT_REASON_VALUES, PracticalFlashcardExitReason } from '../practical-flashcard.types';

export class ResolvePracticalFlashcardAttemptDto {
  @ApiPropertyOptional({ description: '最终结算 K 线 index；默认使用当前已推进到的 K 线' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  finalCandleIndex?: number;

  @ApiProperty()
  @Type(() => Boolean)
  @IsBoolean()
  marketStructureAnalysisCorrect: boolean;

  @ApiProperty()
  @Type(() => Boolean)
  @IsBoolean()
  priceActionAnalysisCorrect: boolean;

  @ApiProperty()
  @Type(() => Boolean)
  @IsBoolean()
  orderFlowAnalysisUsed: boolean;

  @ApiPropertyOptional({ description: '未使用足迹图时可不传' })
  @ValidateIf((o) => o.orderFlowAnalysisUsed === true)
  @Type(() => Boolean)
  @IsBoolean()
  orderFlowAnalysisCorrect?: boolean;

  @ApiProperty()
  @Type(() => Boolean)
  @IsBoolean()
  riskRewardSetupCorrect: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  realizedR?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isWin?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxFavorableR?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxAdverseR?: number;

  @ApiPropertyOptional({ description: '离场 K 线 index；不传时由后端按止盈止损触发点或 finalCandleIndex 推导' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  tradeClosedCandleIndex?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  exitPrice?: number;

  @ApiPropertyOptional({ enum: PRACTICAL_FLASHCARD_EXIT_REASON_VALUES })
  @IsOptional()
  @IsIn(PRACTICAL_FLASHCARD_EXIT_REASON_VALUES)
  exitReason?: PracticalFlashcardExitReason;

  @ApiPropertyOptional({ description: 'PF-M3 绘图快照' })
  @IsOptional()
  @IsObject()
  drawingSnapshot?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mistakeReasons?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summary?: string;
}
