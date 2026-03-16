import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import {
  DICTIONARY_BIZ_TYPE_VALUES,
  DICTIONARY_SELECTION_MODE_VALUES,
  DICTIONARY_STATUS_VALUES,
  DictionaryBizType,
  DictionarySelectionMode,
  DictionaryStatus,
} from '../dictionary.types';

export class UpdateDictionaryCategoryDto {
  @ApiPropertyOptional({ example: '交易标签' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: '用于交易记录打标签' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ enum: DICTIONARY_BIZ_TYPE_VALUES, example: 'TRADE' })
  @IsOptional()
  @IsString()
  @IsIn(DICTIONARY_BIZ_TYPE_VALUES)
  bizType?: DictionaryBizType;

  @ApiPropertyOptional({ enum: DICTIONARY_SELECTION_MODE_VALUES, example: 'MULTIPLE' })
  @IsOptional()
  @IsString()
  @IsIn(DICTIONARY_SELECTION_MODE_VALUES)
  selectionMode?: DictionarySelectionMode;

  @ApiPropertyOptional({ enum: DICTIONARY_STATUS_VALUES, example: 'ACTIVE' })
  @IsOptional()
  @IsString()
  @IsIn(DICTIONARY_STATUS_VALUES)
  status?: DictionaryStatus;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
