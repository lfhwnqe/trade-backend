import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
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
import { IsIn } from 'class-validator';

class FlashcardRandomFiltersDto {
  @ApiPropertyOptional({ enum: FLASHCARD_DIRECTION_VALUES, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsIn(FLASHCARD_DIRECTION_VALUES, { each: true })
  direction?: FlashcardDirection[];

  @ApiPropertyOptional({ enum: FLASHCARD_CONTEXT_VALUES, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsIn(FLASHCARD_CONTEXT_VALUES, { each: true })
  context?: FlashcardContext[];

  @ApiPropertyOptional({ enum: FLASHCARD_ORDER_FLOW_FEATURE_VALUES, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsIn(FLASHCARD_ORDER_FLOW_FEATURE_VALUES, { each: true })
  orderFlowFeature?: FlashcardOrderFlowFeature[];

  @ApiPropertyOptional({ enum: FLASHCARD_RESULT_VALUES, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsIn(FLASHCARD_RESULT_VALUES, { each: true })
  result?: FlashcardResult[];
}

export class RandomFlashcardCardsDto {
  @ApiPropertyOptional({ type: FlashcardRandomFiltersDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => FlashcardRandomFiltersDto)
  filters?: FlashcardRandomFiltersDto;

  @ApiPropertyOptional({ example: 20, default: 20, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  count: number = 20;
}

export { FlashcardRandomFiltersDto };
