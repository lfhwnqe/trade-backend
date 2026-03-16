import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import {
  DICTIONARY_STATUS_VALUES,
  DictionaryStatus,
} from '../dictionary.types';

export class ListDictionaryItemsDto {
  @ApiPropertyOptional({ example: 'trade_tag', description: '建议必传' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9_]+$/)
  @MaxLength(64)
  categoryCode?: string;

  @ApiPropertyOptional({ enum: DICTIONARY_STATUS_VALUES })
  @IsOptional()
  @IsString()
  @IsIn(DICTIONARY_STATUS_VALUES)
  status?: DictionaryStatus;

  @ApiPropertyOptional({ example: '突破' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;
}
