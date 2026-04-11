import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength } from 'class-validator';
import { ALLOWED_IMAGE_TYPES } from '../../image/types/image.types';
import {
  TRADE_FLASHCARD_IMAGE_SCOPE_VALUES,
  TradeFlashcardImageScope,
} from '../trade-flashcard.types';

export class GetTradeFlashcardUploadUrlDto {
  @ApiProperty({ example: 'pre-entry-20260410-001.png' })
  @IsString()
  @MaxLength(200)
  fileName: string;

  @ApiProperty({ example: 'image/png', enum: ALLOWED_IMAGE_TYPES })
  @IsString()
  @IsIn(ALLOWED_IMAGE_TYPES)
  contentType: string;

  @ApiProperty({ example: 'pre-entry', enum: TRADE_FLASHCARD_IMAGE_SCOPE_VALUES })
  @IsString()
  @IsIn(TRADE_FLASHCARD_IMAGE_SCOPE_VALUES)
  scope: TradeFlashcardImageScope;
}
