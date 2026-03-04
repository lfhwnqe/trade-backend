import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateFlashcardNoteDto {
  @ApiPropertyOptional({ example: '该位置出现假突破，下一次注意等待二次确认。' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
