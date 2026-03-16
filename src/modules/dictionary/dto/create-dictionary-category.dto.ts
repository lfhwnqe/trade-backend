import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import {
  DICTIONARY_BIZ_TYPE_VALUES,
  DICTIONARY_SELECTION_MODE_VALUES,
  DictionaryBizType,
  DictionarySelectionMode,
} from '../dictionary.types';

export class CreateDictionaryCategoryDto {
  @ApiProperty({ example: 'trade_tag', description: '分类编码，创建后不可修改' })
  @IsString()
  @Matches(/^[a-z0-9_]+$/)
  @MaxLength(64)
  code: string;

  @ApiProperty({ example: '交易标签' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: '用于交易记录打标签' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ enum: DICTIONARY_BIZ_TYPE_VALUES, example: 'TRADE' })
  @IsString()
  @IsIn(DICTIONARY_BIZ_TYPE_VALUES)
  bizType: DictionaryBizType;

  @ApiProperty({ enum: DICTIONARY_SELECTION_MODE_VALUES, example: 'MULTIPLE' })
  @IsString()
  @IsIn(DICTIONARY_SELECTION_MODE_VALUES)
  selectionMode: DictionarySelectionMode;

  @ApiPropertyOptional({ example: 100, default: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
