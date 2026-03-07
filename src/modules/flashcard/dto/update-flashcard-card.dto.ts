import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import {
  FLASHCARD_BEHAVIOR_TYPE_VALUES,
  FLASHCARD_DIRECTION_VALUES,
  FlashcardAction,
  FlashcardBehaviorType,
  FlashcardDirection,
  FLASHCARD_INVALIDATION_TYPE_VALUES,
  FlashcardInvalidationType,
} from '../flashcard.types';

export class UpdateFlashcardCardDto {
  @ApiPropertyOptional({
    example:
      'https://cdn.example.com/flashcards/u1/question/2026-03-04/abc.png',
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  questionImageUrl?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/flashcards/u1/answer/2026-03-04/def.png',
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  answerImageUrl?: string;

  @ApiPropertyOptional({
    enum: FLASHCARD_DIRECTION_VALUES,
    example: 'SHORT',
    description: '标准动作（推荐字段）',
  })
  @IsOptional()
  @IsString()
  @IsIn(FLASHCARD_DIRECTION_VALUES)
  expectedAction?: FlashcardAction;

  @ApiPropertyOptional({
    enum: FLASHCARD_BEHAVIOR_TYPE_VALUES,
    example: 'FAKE_BREAK_RECLAIM',
    description: '价格行为依据类型',
  })
  @IsOptional()
  @IsString()
  @IsIn(FLASHCARD_BEHAVIOR_TYPE_VALUES)
  behaviorType?: FlashcardBehaviorType;

  @ApiPropertyOptional({
    enum: FLASHCARD_INVALIDATION_TYPE_VALUES,
    example: 'WICK_EXTREME',
    description: '失效/止损逻辑类型',
  })
  @IsOptional()
  @IsString()
  @IsIn(FLASHCARD_INVALIDATION_TYPE_VALUES)
  invalidationType?: FlashcardInvalidationType;

  @ApiPropertyOptional({
    enum: FLASHCARD_DIRECTION_VALUES,
    example: 'SHORT',
    description: '兼容旧字段，仅用于历史请求兼容',
  })
  @IsOptional()
  @IsString()
  @IsIn(FLASHCARD_DIRECTION_VALUES)
  direction?: FlashcardDirection;

  @ApiPropertyOptional({
    example: '该位置出现假突破，下一次注意等待二次确认。',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({
    example: '2026-03-05 09:30 UTC+8',
    description: '行情时间信息（选填）',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  marketTimeInfo?: string;

  @ApiPropertyOptional({ example: 'BTC/USDT', description: '币对信息（选填）' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  symbolPairInfo?: string;
}
