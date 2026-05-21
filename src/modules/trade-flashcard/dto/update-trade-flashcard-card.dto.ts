import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUrl, MaxLength, ValidateIf } from 'class-validator';
import {
  TRADE_FLASHCARD_PROCESS_RESULT_VALUES,
  TRADE_FLASHCARD_TYPE_VALUES,
  TradeFlashcardProcessResult,
  TradeFlashcardType,
} from '../trade-flashcard.types';

export class UpdateTradeFlashcardCardDto {
  @ApiPropertyOptional({ enum: TRADE_FLASHCARD_TYPE_VALUES, example: 'SIM_TRADE' })
  @IsOptional()
  @IsString()
  @IsIn(TRADE_FLASHCARD_TYPE_VALUES)
  tradeFlashcardType?: TradeFlashcardType;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/trade-flashcards/u1/pre-entry/2026-04-10/abc.png',
    description: '入场前截图旧主图字段；兼容读取，更新时优先使用 preEntryImageUrls[0]',
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  preEntryImageUrl?: string;

  @ApiPropertyOptional({ type: [String], description: '入场前走势跟踪截图，最多 10 张；第一张同步为兼容 preEntryImageUrl' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({}, { each: true })
  preEntryImageUrls?: string[];

  @ApiPropertyOptional({ example: 'https://cdn.example.com/trade-flashcards/u1/post-entry/2026-04-10/def.png' })
  @IsOptional()
  @IsString()
  @ValidateIf((_, value) => value !== '')
  @IsUrl()
  postEntryImageUrl?: string;

  @ApiPropertyOptional({ type: [String], description: '入场时截图，最多 5 张；第一张用于转换常规训练闪卡题图' })
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

  @ApiPropertyOptional({ example: 'https://cdn.example.com/trade-flashcards/u1/final-trend/2026-04-10/final.png' })
  @IsOptional()
  @IsString()
  @ValidateIf((_, value) => value !== '')
  @IsUrl()
  finalTrendImageUrl?: string;

  @ApiPropertyOptional({ type: [String], description: '旧走势截图，最多 5 张；TF-M2 后仅保留兼容' })
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

  @ApiPropertyOptional({ enum: TRADE_FLASHCARD_PROCESS_RESULT_VALUES, example: 'FAIL' })
  @IsOptional()
  @IsString()
  @IsIn(TRADE_FLASHCARD_PROCESS_RESULT_VALUES)
  processResult?: TradeFlashcardProcessResult;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isSystemAligned?: boolean;

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

  @ApiPropertyOptional({ example: '下次遇到同类结构要更耐心等二次确认。' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summary?: string;
}
