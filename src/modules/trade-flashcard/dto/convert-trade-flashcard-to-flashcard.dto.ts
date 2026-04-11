import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  FLASHCARD_BEHAVIOR_TYPE_VALUES,
  FLASHCARD_DIRECTION_VALUES,
  FLASHCARD_INVALIDATION_TYPE_VALUES,
  FLASHCARD_SYSTEM_OUTCOME_TYPE_VALUES,
  FlashcardAction,
  FlashcardBehaviorType,
  FlashcardInvalidationType,
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

  @ApiPropertyOptional({ enum: FLASHCARD_BEHAVIOR_TYPE_VALUES, example: 'ZONE_REJECTION' })
  @IsOptional()
  @IsString()
  @IsIn(FLASHCARD_BEHAVIOR_TYPE_VALUES)
  behaviorType?: FlashcardBehaviorType;

  @ApiPropertyOptional({ enum: FLASHCARD_INVALIDATION_TYPE_VALUES, example: 'REJECTION_EXTREME_BROKEN' })
  @IsOptional()
  @IsString()
  @IsIn(FLASHCARD_INVALIDATION_TYPE_VALUES)
  invalidationType?: FlashcardInvalidationType;

  @ApiPropertyOptional({ example: '补充作为训练题的说明。' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
