import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  FLASHCARD_DIRECTION_VALUES,
  FLASHCARD_SYSTEM_OUTCOME_TYPE_VALUES,
  FlashcardAction,
  FlashcardSystemOutcomeType,
} from '../../flashcard/flashcard.types';

export class ConvertTradeFlashcardToFlashcardDto {
  @ApiProperty({ enum: FLASHCARD_DIRECTION_VALUES, example: 'LONG' })
  @IsString()
  @IsIn(FLASHCARD_DIRECTION_VALUES)
  expectedAction: FlashcardAction;

  @ApiProperty({ enum: FLASHCARD_SYSTEM_OUTCOME_TYPE_VALUES, example: 'SYSTEM_WIN' })
  @IsString()
  @IsIn(FLASHCARD_SYSTEM_OUTCOME_TYPE_VALUES)
  systemOutcomeType: FlashcardSystemOutcomeType;

  @ApiPropertyOptional({ example: '补充作为训练题的说明。' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({
    example: '2026-04-10 14:35 UTC+8',
    description: '转换为常规训练闪卡时的行情时间；原交易闪卡缺失时可在这里补录',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  marketTimeInfo?: string;

  @ApiPropertyOptional({
    example: 'BTC/USDT',
    description: '转换为常规训练闪卡时的币对；原交易闪卡缺失时可在这里补录',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  symbolPairInfo?: string;

  @ApiPropertyOptional({
    example: 'pullback_continuation',
    description: '转换为常规训练闪卡时的剧本类型；原交易闪卡缺失时可在这里补录',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  playbookType?: string;
}
