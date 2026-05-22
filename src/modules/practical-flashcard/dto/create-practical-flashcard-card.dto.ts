import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import {
  PRACTICAL_FLASHCARD_DIRECTION_VALUES,
  PRACTICAL_FLASHCARD_INTERVAL_VALUES,
  PRACTICAL_FLASHCARD_VENUE_VALUES,
  PracticalFlashcardDirection,
  PracticalFlashcardInterval,
  PracticalFlashcardVenue,
} from '../practical-flashcard.types';

export class CreatePracticalFlashcardCardDto {
  @ApiProperty({ enum: PRACTICAL_FLASHCARD_VENUE_VALUES, example: 'BINANCE_UM_FUTURES' })
  @IsString()
  @IsIn(PRACTICAL_FLASHCARD_VENUE_VALUES)
  venue: PracticalFlashcardVenue;

  @ApiProperty({ example: 'BTCUSDT' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  symbolPairInfo: string;

  @ApiProperty({ example: '2026-05-22 14:30:00' })
  @IsString()
  @MaxLength(100)
  entryTimeInfo: string;

  @ApiProperty({ example: '2026-05-22 18:30:00' })
  @IsString()
  @MaxLength(100)
  exitTimeInfo: string;

  @ApiPropertyOptional({ enum: PRACTICAL_FLASHCARD_INTERVAL_VALUES, default: '15m' })
  @IsOptional()
  @IsString()
  @IsIn(PRACTICAL_FLASHCARD_INTERVAL_VALUES)
  primaryInterval?: PracticalFlashcardInterval;

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

  @ApiPropertyOptional({ enum: PRACTICAL_FLASHCARD_DIRECTION_VALUES })
  @IsOptional()
  @IsString()
  @IsIn(PRACTICAL_FLASHCARD_DIRECTION_VALUES)
  expectedDirection?: PracticalFlashcardDirection;

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

  @ApiProperty({ example: 'pullback_continuation' })
  @IsString()
  @MaxLength(100)
  playbookType: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  tagCodes?: string[];

  @ApiPropertyOptional({ type: [String], description: '关键足迹图附件 URL' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({}, { each: true })
  orderFlowImageUrls?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  orderFlowRemark?: string;

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
