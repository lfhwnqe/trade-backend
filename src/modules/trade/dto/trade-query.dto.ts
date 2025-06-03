import { IsOptional, IsNumber, Min, IsString, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class DateTimeRangeDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}

export class TradeQueryDto {
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  page: number = 1;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  limit?: number;

  @IsNumber()
  @Type(() => Number)
  @Min(1)
  pageSize: number = 20;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  grade?: string;

  @IsOptional()
  @IsString()
  marketStructure?: string;

  @IsOptional()
  @IsString()
  entryDirection?: string;

  @IsOptional()
  @IsString()
  tradeStatus?: string;

  @IsOptional()
  @IsString()
  tradeResult?: string;

  @IsOptional()
  @IsString()
  tradeType?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => DateTimeRangeDto)
  dateTimeRange?: DateTimeRangeDto;
}