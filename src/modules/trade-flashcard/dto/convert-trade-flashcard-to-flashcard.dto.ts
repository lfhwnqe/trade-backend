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
}
