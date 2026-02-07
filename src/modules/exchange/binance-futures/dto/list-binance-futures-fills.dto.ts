import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';

export class ListBinanceFuturesFillsDto {
  @ApiProperty({ required: false, description: '分页游标（base64）' })
  @IsOptional()
  @IsString()
  nextToken?: string;

  @ApiProperty({ required: false, description: '每页数量，默认 50，最大 200' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;
}
