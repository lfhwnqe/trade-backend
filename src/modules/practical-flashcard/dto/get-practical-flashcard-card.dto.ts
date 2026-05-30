import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PRACTICAL_FLASHCARD_INTERVAL_VALUES, PracticalFlashcardInterval } from '../practical-flashcard.types';

export class GetPracticalFlashcardCardDto {
  @ApiPropertyOptional({ enum: PRACTICAL_FLASHCARD_INTERVAL_VALUES, description: '训练页临时回放周期；不传时使用卡片默认周期' })
  @IsOptional()
  @IsIn(PRACTICAL_FLASHCARD_INTERVAL_VALUES)
  replayInterval?: PracticalFlashcardInterval;
}
