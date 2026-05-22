import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListPracticalFlashcardAttemptsDto {
  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cardId?: string;

  @ApiPropertyOptional({ enum: ['LONG', 'SHORT', 'NO_ENTRY'] })
  @IsOptional()
  @IsString()
  @IsIn(['LONG', 'SHORT', 'NO_ENTRY'])
  decision?: 'LONG' | 'SHORT' | 'NO_ENTRY';

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isWin?: boolean;
}
