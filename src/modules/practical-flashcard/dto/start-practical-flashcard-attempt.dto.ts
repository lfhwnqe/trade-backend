import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class StartPracticalFlashcardAttemptDto {
  @ApiProperty({ description: '实操闪卡 cardId' })
  @IsString()
  @MaxLength(120)
  cardId: string;
}
