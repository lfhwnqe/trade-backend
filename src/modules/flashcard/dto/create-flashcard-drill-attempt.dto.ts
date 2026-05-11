import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  FLASHCARD_DRILL_MISTAKE_REASON_VALUES,
  FLASHCARD_DIRECTION_VALUES,
  FlashcardAction,
  FlashcardDrillMistakeReason,
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

  @ApiPropertyOptional({
    enum: FLASHCARD_DRILL_MISTAKE_REASON_VALUES,
    isArray: true,
    description: '做错题后的错因集合；当后端判定 isCorrect=false 时至少选择一个',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(FLASHCARD_DRILL_MISTAKE_REASON_VALUES, { each: true })
  mistakeReasons?: FlashcardDrillMistakeReason[];

  @ApiPropertyOptional({
    enum: FLASHCARD_DRILL_MISTAKE_REASON_VALUES,
    description: '兼容旧单选字段；新调用请使用 mistakeReasons',
    deprecated: true,
  })
  @IsOptional()
  @IsString()
  @IsIn(FLASHCARD_DRILL_MISTAKE_REASON_VALUES)
  mistakeReason?: FlashcardDrillMistakeReason;
}
