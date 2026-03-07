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
  FLASHCARD_BEHAVIOR_TYPE_VALUES,
  FLASHCARD_INVALIDATION_TYPE_VALUES,
  FlashcardBehaviorType,
  FlashcardInvalidationType,
} from '../flashcard.types';
import { IsIn } from 'class-validator';

class FlashcardRandomFiltersDto {
  @ApiPropertyOptional({ enum: FLASHCARD_BEHAVIOR_TYPE_VALUES, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsIn(FLASHCARD_BEHAVIOR_TYPE_VALUES, { each: true })
  behaviorType?: FlashcardBehaviorType[];

  @ApiPropertyOptional({
    enum: FLASHCARD_INVALIDATION_TYPE_VALUES,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsIn(FLASHCARD_INVALIDATION_TYPE_VALUES, { each: true })
  invalidationType?: FlashcardInvalidationType[];
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
