import { IsString, IsArray, IsNumber, IsOptional, ArrayMaxSize, Min, Max, IsIn, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MarketStructure, EntryDirection, ImageResource } from './create-trade.dto';

export class UpdateTradeDto {
  @IsOptional()
  @IsString()
  dateTimeRange?: string;

  @IsOptional()
  @IsEnum(MarketStructure)
  marketStructure?: MarketStructure;

  // signalType 字段已删除，不再需要

  @IsOptional()
  @IsNumber()
  vah?: number;

  @IsOptional()
  @IsNumber()
  val?: number;

  @IsOptional()
  @IsNumber()
  poc?: number;

  @IsOptional()
  @IsEnum(EntryDirection)
  entryDirection?: EntryDirection;

  @IsOptional()
  @IsNumber()
  entry?: number;

  @IsOptional()
  @IsNumber()
  stopLoss?: number;

  @IsOptional()
  @IsNumber()
  target?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageResource)
  volumeProfileImage?: ImageResource[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageResource)
  @ArrayMaxSize(3)
  hypothesisPaths?: ImageResource[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageResource)
  actualPath?: ImageResource[];

  @IsOptional()
  @IsNumber()
  exit?: number;

  @IsOptional()
  @IsNumber()
  profitLoss?: number;

  @IsOptional()
  @IsString()
  rr?: string;

  @IsOptional()
  @IsString()
  analysisResult?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  executionMindsetScore?: number;

  @IsOptional()
  @IsString()
  improvement?: string;
}