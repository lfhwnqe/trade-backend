import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsInt, Min, Max, IsIn } from 'class-validator';

export class ListBinanceFuturesPositionsDto {
  @ApiProperty({ required: false, description: '分页游标（base64）' })
  @IsOptional()
  @IsString()
  nextToken?: string;

  @ApiProperty({ required: false, description: '每页数量，默认 20，最大 100' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiProperty({
    required: false,
    description: '范围：7d（默认）| 30d | 1y',
    example: '7d',
  })
  @IsOptional()
  @IsIn(['7d', '30d', '1y'])
  range?: '7d' | '30d' | '1y';
}
