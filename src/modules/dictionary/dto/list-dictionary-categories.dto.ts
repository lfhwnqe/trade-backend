import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  DICTIONARY_BIZ_TYPE_VALUES,
  DICTIONARY_STATUS_VALUES,
  DictionaryBizType,
  DictionaryStatus,
} from '../dictionary.types';

export class ListDictionaryCategoriesDto {
  @ApiPropertyOptional({ enum: DICTIONARY_BIZ_TYPE_VALUES })
  @IsOptional()
  @IsString()
  @IsIn(DICTIONARY_BIZ_TYPE_VALUES)
  bizType?: DictionaryBizType;

  @ApiPropertyOptional({ enum: DICTIONARY_STATUS_VALUES })
  @IsOptional()
  @IsString()
  @IsIn(DICTIONARY_STATUS_VALUES)
  status?: DictionaryStatus;

  @ApiPropertyOptional({ example: '交易' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;
}
