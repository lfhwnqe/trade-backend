import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import {
  FLASHCARD_CONTEXT_VALUES,
  FLASHCARD_DIRECTION_VALUES,
  FLASHCARD_ORDER_FLOW_FEATURE_VALUES,
  FLASHCARD_RESULT_VALUES,
  FlashcardAction,
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

  @ApiProperty({
    enum: FLASHCARD_DIRECTION_VALUES,
    example: 'SHORT',
    description: '标准动作（推荐字段）',
  })
  @IsString()
  @IsIn(FLASHCARD_DIRECTION_VALUES)
  expectedAction: FlashcardAction;

  @ApiPropertyOptional({
    enum: FLASHCARD_DIRECTION_VALUES,
    example: 'SHORT',
    description: '兼容旧字段，若传 expectedAction 可省略',
  })
  @IsOptional()
  @IsString()
  @IsIn(FLASHCARD_DIRECTION_VALUES)
  direction?: FlashcardDirection;

  @ApiPropertyOptional({ enum: FLASHCARD_CONTEXT_VALUES, example: 'RANGE' })
  @IsOptional()
  @IsString()
  @IsIn(FLASHCARD_CONTEXT_VALUES)
  context?: FlashcardContext;

  @ApiPropertyOptional({ enum: FLASHCARD_ORDER_FLOW_FEATURE_VALUES, example: 'SWEEP' })
  @IsOptional()
  @IsString()
  @IsIn(FLASHCARD_ORDER_FLOW_FEATURE_VALUES)
  orderFlowFeature?: FlashcardOrderFlowFeature;

  @ApiPropertyOptional({ enum: FLASHCARD_RESULT_VALUES, example: 'LOSS' })
  @IsOptional()
  @IsString()
  @IsIn(FLASHCARD_RESULT_VALUES)
  result?: FlashcardResult;

  @ApiPropertyOptional({ example: 'sweep 后失败回落。' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ example: '2026-03-05 09:30 UTC+8', description: '行情时间信息（选填）' })
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
