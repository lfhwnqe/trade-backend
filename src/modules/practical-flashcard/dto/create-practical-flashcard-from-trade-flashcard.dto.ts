import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  PRACTICAL_FLASHCARD_INTERVAL_VALUES,
  PracticalFlashcardInterval,
} from '../practical-flashcard.types';

export class CreatePracticalFlashcardFromTradeFlashcardDto {
  @ApiProperty({ example: '2026-05-22 18:30:00' })
  @IsString()
  @MaxLength(100)
  exitTimeInfo: string;

  @ApiProperty({ enum: PRACTICAL_FLASHCARD_INTERVAL_VALUES, example: '15m' })
  @IsString()
  @IsNotEmpty()
  @IsIn(PRACTICAL_FLASHCARD_INTERVAL_VALUES)
  primaryInterval: PracticalFlashcardInterval;

  @ApiPropertyOptional({ example: 'Asia/Shanghai', description: '用户浏览器 IANA 时区，用于解析无时区时间字符串' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timeZone?: string;

  @ApiPropertyOptional({ example: '2026-05-22 08:30:00' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  snapshotStartTime?: string;

  @ApiPropertyOptional({ example: '2026-05-22 20:30:00' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  snapshotEndTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  standardEntryPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  standardStopLossPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  standardTakeProfitPrice?: number;
}
