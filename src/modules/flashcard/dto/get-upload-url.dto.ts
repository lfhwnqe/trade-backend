import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength } from 'class-validator';
import { ALLOWED_IMAGE_TYPES } from '../../image/types/image.types';
import { FLASHCARD_IMAGE_SCOPE_VALUES, FlashcardImageScope } from '../flashcard.types';

export class GetFlashcardUploadUrlDto {
  @ApiProperty({ example: 'question-20260304-001.png' })
  @IsString()
  @MaxLength(200)
  fileName: string;

  @ApiProperty({
    example: 'image/png',
    enum: ALLOWED_IMAGE_TYPES,
  })
  @IsString()
  @IsIn(ALLOWED_IMAGE_TYPES)
  contentType: string;

  @ApiProperty({
    example: 'question',
    enum: FLASHCARD_IMAGE_SCOPE_VALUES,
  })
  @IsString()
  @IsIn(FLASHCARD_IMAGE_SCOPE_VALUES)
  scope: FlashcardImageScope;
}
