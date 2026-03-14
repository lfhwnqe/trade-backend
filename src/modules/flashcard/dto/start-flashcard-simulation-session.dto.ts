import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, Max, Min, ValidateNested } from 'class-validator';
import {
  FLASHCARD_BEHAVIOR_TYPE_VALUES,
  FLASHCARD_INVALIDATION_TYPE_VALUES,
  FlashcardBehaviorType,
  FlashcardInvalidationType,
} from '../flashcard.types';

class FlashcardSimulationFiltersDto {
  @ApiPropertyOptional({ enum: FLASHCARD_BEHAVIOR_TYPE_VALUES, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(FLASHCARD_BEHAVIOR_TYPE_VALUES, { each: true })
  behaviorType?: FlashcardBehaviorType[];

  @ApiPropertyOptional({ enum: FLASHCARD_INVALIDATION_TYPE_VALUES, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(FLASHCARD_INVALIDATION_TYPE_VALUES, { each: true })
  invalidationType?: FlashcardInvalidationType[];
}

export class StartFlashcardSimulationSessionDto {
  @ApiPropertyOptional({ example: 5, default: 5, minimum: 1, maximum: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  count: number = 5;

  @ApiPropertyOptional({ type: FlashcardSimulationFiltersDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => FlashcardSimulationFiltersDto)
  filters?: FlashcardSimulationFiltersDto;
}
