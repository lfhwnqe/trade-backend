import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsHexColor,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  DICTIONARY_STATUS_VALUES,
  DictionaryStatus,
} from '../dictionary.types';

export class UpdateDictionaryItemDto {
  @ApiPropertyOptional({ example: '假突破' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @ApiPropertyOptional({ type: [String], example: ['扫流动性失败', '假上破'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  alias?: string[];

  @ApiPropertyOptional({ example: '价格短暂突破后重新回到关键区域' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: '#ef4444' })
  @IsOptional()
  @IsHexColor()
  color?: string;

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
