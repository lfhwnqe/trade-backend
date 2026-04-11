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
    example: ['https://cdn.example.com/trade-flashcards/u1/progress/2026-04-10/p1.png'],
    description: '走势截图，最多 5 张',
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
