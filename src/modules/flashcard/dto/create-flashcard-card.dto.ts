import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, IsUrl, MaxLength, ValidateIf } from 'class-validator';
import {
  FLASHCARD_BEHAVIOR_TYPE_VALUES,
  FLASHCARD_DIRECTION_VALUES,
  FlashcardAction,
  FlashcardBehaviorType,
  FlashcardDirection,
  FLASHCARD_INVALIDATION_TYPE_VALUES,
  FlashcardInvalidationType,
} from '../flashcard.types';

export class CreateFlashcardCardDto {
  @ApiProperty({ example: 'https://cdn.example.com/flashcards/u1/question/2026-03-04/abc.png' })
  @IsString()
  @IsUrl()
  questionImageUrl: string;

  @ApiProperty({ example: 'https://cdn.example.com/flashcards/u1/answer/2026-03-04/def.png' })
  @IsString()
  @IsUrl()
  answerImageUrl: string;

  @ApiProperty({
    enum: FLASHCARD_DIRECTION_VALUES,
    example: 'SHORT',
    description: '标准动作（推荐字段）',
  })
  @IsString()
  @IsIn(FLASHCARD_DIRECTION_VALUES)
  expectedAction: FlashcardAction;

  @ApiPropertyOptional({
    enum: FLASHCARD_BEHAVIOR_TYPE_VALUES,
    example: 'FAKE_BREAK_RECLAIM',
    description: '价格行为依据类型',
  })
  @IsOptional()
  @IsString()
  @IsIn(FLASHCARD_BEHAVIOR_TYPE_VALUES)
  behaviorType?: FlashcardBehaviorType;

  @ApiPropertyOptional({
    enum: FLASHCARD_INVALIDATION_TYPE_VALUES,
    example: 'WICK_EXTREME',
    description: '失效/止损逻辑类型',
  })
  @IsOptional()
  @IsString()
  @IsIn(FLASHCARD_INVALIDATION_TYPE_VALUES)
  invalidationType?: FlashcardInvalidationType;

  @ApiPropertyOptional({
    enum: FLASHCARD_DIRECTION_VALUES,
    example: 'SHORT',
    description: '兼容旧字段，仅用于历史请求兼容',
  })
  @IsOptional()
  @IsString()
  @IsIn(FLASHCARD_DIRECTION_VALUES)
  direction?: FlashcardDirection;

  @ApiPropertyOptional({ example: 'sweep 后失败回落。' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({
    example: true,
    description: '是否属于符合系统信号但因后续走势发展不如意而提前手动离场的题',
  })
  @IsOptional()
  @IsBoolean()
  earlyExitTag?: boolean;

  @ApiPropertyOptional({
    example: '触发后迟迟没有扩张，且关键回踩承接变弱，所以手动提前离场。',
    description: '提前离场原因；当 earlyExitTag=true 时建议填写',
  })
  @ValidateIf((o) => o.earlyExitTag === true || typeof o.earlyExitReason === 'string')
  @IsString()
  @MaxLength(500)
  earlyExitReason?: string;

  @ApiPropertyOptional({ example: '2026-03-05 09:30 UTC+8', description: '行情时间信息（选填）' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  marketTimeInfo?: string;

  @ApiPropertyOptional({ example: 'BTC/USDT', description: '币对信息（选填）' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  symbolPairInfo?: string;
}
