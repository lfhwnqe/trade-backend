import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength } from 'class-validator';
import { ALLOWED_IMAGE_TYPES } from '../../image/types/image.types';
import {
  IMAGE_RECOGNITION_FLASHCARD_IMAGE_SCOPE_VALUES,
  ImageRecognitionFlashcardImageScope,
} from '../image-recognition-flashcard.types';

export class GetImageRecognitionFlashcardUploadUrlDto {
  @ApiProperty({ example: 'recognition-card.png' })
  @IsString()
  @MaxLength(200)
  fileName: string;

  @ApiProperty({ example: 'image/png', enum: ALLOWED_IMAGE_TYPES })
  @IsString()
  @IsIn(ALLOWED_IMAGE_TYPES)
  contentType: string;

  @ApiProperty({ example: 'card-image', enum: IMAGE_RECOGNITION_FLASHCARD_IMAGE_SCOPE_VALUES })
  @IsString()
  @IsIn(IMAGE_RECOGNITION_FLASHCARD_IMAGE_SCOPE_VALUES)
  scope: ImageRecognitionFlashcardImageScope;
}
