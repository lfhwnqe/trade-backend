import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateFlashcardCardDto } from './update-flashcard-card.dto';

export class DuplicateFlashcardCardDto {
  @ApiPropertyOptional({
    type: UpdateFlashcardCardDto,
    description: '复制时可覆盖的卡片字段；未传时完全按原卡可复用字段复制',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateFlashcardCardDto)
  overrides?: UpdateFlashcardCardDto;
}
