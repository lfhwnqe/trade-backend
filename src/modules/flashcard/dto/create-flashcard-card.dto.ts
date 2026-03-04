import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import {
  FLASHCARD_CONTEXT_VALUES,
  FLASHCARD_DIRECTION_VALUES,
  FLASHCARD_ORDER_FLOW_FEATURE_VALUES,
  FLASHCARD_RESULT_VALUES,
  FlashcardContext,
  FlashcardDirection,
  FlashcardOrderFlowFeature,
  FlashcardResult,
} from '../flashcard.types';

export class CreateFlashcardCardDto {
  @ApiProperty({ example: 'https://cdn.example.com/flashcards/u1/question/2026-03-04/abc.png' })
  @IsString()
  @IsUrl()
  questionImageUrl: string;

  @ApiProperty({ example: 'https://cdn.example.com/flashcards/u1/answer/2026-03-04/def.png' })
  @IsString()
  @IsUrl()
  answerImageUrl: string;

  @ApiProperty({ enum: FLASHCARD_DIRECTION_VALUES, example: 'SHORT' })
  @IsString()
  @IsIn(FLASHCARD_DIRECTION_VALUES)
  direction: FlashcardDirection;

  @ApiProperty({ enum: FLASHCARD_CONTEXT_VALUES, example: 'RANGE' })
  @IsString()
  @IsIn(FLASHCARD_CONTEXT_VALUES)
  context: FlashcardContext;

  @ApiProperty({ enum: FLASHCARD_ORDER_FLOW_FEATURE_VALUES, example: 'SWEEP' })
  @IsString()
  @IsIn(FLASHCARD_ORDER_FLOW_FEATURE_VALUES)
  orderFlowFeature: FlashcardOrderFlowFeature;

  @ApiProperty({ enum: FLASHCARD_RESULT_VALUES, example: 'LOSS' })
  @IsString()
  @IsIn(FLASHCARD_RESULT_VALUES)
  result: FlashcardResult;

  @ApiPropertyOptional({ example: 'sweep 后失败回落。' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
