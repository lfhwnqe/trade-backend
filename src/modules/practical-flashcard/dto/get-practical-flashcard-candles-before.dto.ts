import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PRACTICAL_FLASHCARD_INTERVAL_VALUES, PracticalFlashcardInterval } from '../practical-flashcard.types';

export class GetPracticalFlashcardCandlesBeforeDto {
  @ApiProperty({ example: 1716206400000, description: '当前页面最早 K 线 openTime，返回它之前的历史 K 线' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  beforeOpenTime!: number;

  @ApiProperty({ example: 500, default: 500, minimum: 1, maximum: 1000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit: number = 500;

  @ApiPropertyOptional({ enum: PRACTICAL_FLASHCARD_INTERVAL_VALUES, description: '当前图表回放周期；不传时使用卡片默认周期' })
  @IsOptional()
  @IsIn(PRACTICAL_FLASHCARD_INTERVAL_VALUES)
  replayInterval?: PracticalFlashcardInterval;
}
