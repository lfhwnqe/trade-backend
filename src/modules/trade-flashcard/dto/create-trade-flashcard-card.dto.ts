import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import {
  TRADE_FLASHCARD_PROCESS_RESULT_VALUES,
  TRADE_FLASHCARD_TYPE_VALUES,
  TradeFlashcardProcessResult,
  TradeFlashcardType,
} from '../trade-flashcard.types';

export class CreateTradeFlashcardCardDto {
  @ApiProperty({ enum: TRADE_FLASHCARD_TYPE_VALUES, example: 'REAL_TRADE' })
  @IsString()
  @IsIn(TRADE_FLASHCARD_TYPE_VALUES)
  tradeFlashcardType: TradeFlashcardType;

  @ApiProperty({ example: 'https://cdn.example.com/trade-flashcards/u1/pre-entry/2026-04-10/abc.png' })
  @IsString()
  @IsUrl()
  preEntryImageUrl: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/trade-flashcards/u1/post-entry/2026-04-10/def.png' })
  @IsOptional()
  @IsString()
  @IsUrl()
  postEntryImageUrl?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['https://cdn.example.com/trade-flashcards/u1/entry/2026-04-10/e1.png'],
    description: '入场时截图，最多 5 张；第一张用于转换常规训练闪卡题图',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUrl({}, { each: true })
  entryImageUrls?: string[];

  @ApiPropertyOptional({ example: '2026-04-10 14:38 UTC+8' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  entryTimeInfo?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/trade-flashcards/u1/final-trend/2026-04-10/final.png',
    description: '最终走势截图；由旧入场后截图语义迁移而来',
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  finalTrendImageUrl?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['https://cdn.example.com/trade-flashcards/u1/progress/2026-04-10/p1.png'],
    description: '旧走势截图，最多 5 张；TF-M2 后仅保留兼容，不再返回展示或参与转换',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUrl({}, { each: true })
  progressImageUrls?: string[];

  @ApiPropertyOptional({ example: '2026-04-10 14:35 UTC+8' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  marketTimeInfo?: string;

  @ApiPropertyOptional({ example: 'BTC/USDT' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  symbolPairInfo?: string;

  @ApiPropertyOptional({ example: 'pullback_continuation' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  playbookType?: string;

  @ApiPropertyOptional({ enum: TRADE_FLASHCARD_PROCESS_RESULT_VALUES, example: 'SUCCESS' })
  @IsOptional()
  @IsString()
  @IsIn(TRADE_FLASHCARD_PROCESS_RESULT_VALUES)
  processResult?: TradeFlashcardProcessResult;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isSystemAligned?: boolean;

  @ApiPropertyOptional({ description: '字典标签编码（来自 flashcard_tag 分类）', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  tagCodes?: string[];

  @ApiPropertyOptional({ example: '记录一次真实交易从入场前到结束的完整过程。' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ example: '这次交易在等待确认后执行更稳，问题出在止盈过早。' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summary?: string;
}
