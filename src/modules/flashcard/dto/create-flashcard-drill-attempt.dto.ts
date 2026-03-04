import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  FLASHCARD_DIRECTION_VALUES,
  FlashcardAction,
} from '../flashcard.types';

export class CreateFlashcardDrillAttemptDto {
  @ApiProperty({ description: '题目 cardId' })
  @IsString()
  cardId: string;

  @ApiProperty({
    enum: FLASHCARD_DIRECTION_VALUES,
    example: 'SHORT',
    description: '用户作答动作',
  })
  @IsString()
  @IsIn(FLASHCARD_DIRECTION_VALUES)
  userAction: FlashcardAction;

  @ApiPropertyOptional({
    description: '是否收藏该题。true=收藏；false=取消收藏；不传=不变更',
  })
  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;

  @ApiPropertyOptional({ description: '备注（会回写题库）' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
