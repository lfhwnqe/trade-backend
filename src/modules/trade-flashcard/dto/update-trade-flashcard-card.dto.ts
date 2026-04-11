import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import {
  TRADE_FLASHCARD_TYPE_VALUES,
  TradeFlashcardType,
} from '../trade-flashcard.types';

export class UpdateTradeFlashcardCardDto {
  @ApiPropertyOptional({ enum: TRADE_FLASHCARD_TYPE_VALUES, example: 'SIM_TRADE' })
  @IsOptional()
  @IsString()
  @IsIn(TRADE_FLASHCARD_TYPE_VALUES)
  tradeFlashcardType?: TradeFlashcardType;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/trade-flashcards/u1/pre-entry/2026-04-10/abc.png' })
  @IsOptional()
  @IsString()
  @IsUrl()
  preEntryImageUrl?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/trade-flashcards/u1/post-entry/2026-04-10/def.png' })
  @IsOptional()
  @IsString()
  @IsUrl()
  postEntryImageUrl?: string;

  @ApiPropertyOptional({ type: [String], description: '走势截图，最多 5 张' })
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

  @ApiPropertyOptional({ description: '字典标签编码（来自 flashcard_tag 分类）', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  tagCodes?: string[];

  @ApiPropertyOptional({ example: '补充后续走势变化。' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
