import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  PRACTICAL_FLASHCARD_STATUS_VALUES,
  PracticalFlashcardStatus,
} from '../practical-flashcard.types';

export class ListPracticalFlashcardCardsDto {
  @ApiPropertyOptional({ example: 20, default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ enum: PRACTICAL_FLASHCARD_STATUS_VALUES })
  @IsOptional()
  @IsIn(PRACTICAL_FLASHCARD_STATUS_VALUES)
  status?: PracticalFlashcardStatus;

  @ApiPropertyOptional({ example: 'BTCUSDT' })
  @IsOptional()
  @IsString()
  symbolPairInfo?: string;

  @ApiPropertyOptional({ example: 'pullback_continuation' })
  @IsOptional()
  @IsString()
  playbookType?: string;
}
