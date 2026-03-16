import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsHexColor,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateDictionaryItemDto {
  @ApiProperty({ example: 'trade_tag' })
  @IsString()
  @Matches(/^[a-z0-9_]+$/)
  @MaxLength(64)
  categoryCode: string;

  @ApiProperty({ example: 'false_breakout' })
  @IsString()
  @Matches(/^[a-z0-9_]+$/)
  @MaxLength(64)
  code: string;

  @ApiProperty({ example: '假突破' })
  @IsString()
  @MaxLength(100)
  label: string;

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

  @ApiPropertyOptional({ example: '#ef4444', description: '标签色值（可选）' })
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiPropertyOptional({ example: 100, default: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
