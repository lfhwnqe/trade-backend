import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  FLASHCARD_DRILL_STATUS_VALUES,
  FlashcardDrillStatus,
} from '../flashcard.types';

export class UpdateFlashcardDrillStatusDto {
  @ApiProperty({
    enum: FLASHCARD_DRILL_STATUS_VALUES,
    example: 'DISABLED',
    description: '常规 Drill 抽题状态',
  })
  @IsString()
  @IsIn(FLASHCARD_DRILL_STATUS_VALUES)
  drillStatus: FlashcardDrillStatus;

  @ApiPropertyOptional({
    example: '题面截图不清晰，先冻结避免继续训练。',
    description: '禁用原因；启用时会被清空',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  disabledReason?: string;
}
