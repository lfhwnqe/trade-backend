import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  FLASHCARD_SOURCE_VALUES,
  FlashcardSource,
} from '../flashcard.types';

export class StartFlashcardDrillSessionDto {
  @ApiPropertyOptional({
    enum: FLASHCARD_SOURCE_VALUES,
    default: 'ALL',
    description: '题源：全部/错题集/收藏库',
  })
  @IsOptional()
  @IsIn(FLASHCARD_SOURCE_VALUES)
  source: FlashcardSource = 'ALL';

  @ApiPropertyOptional({ example: 20, default: 20, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  count: number = 20;
}
