import { IsString, IsArray, IsNumber, IsOptional, ArrayMaxSize, Min, Max, IsIn, IsEnum } from 'class-validator';

export class UpdateTradeDto {
  @IsOptional()
  @IsString()
  dateTimeRange?: string;

  @IsOptional()
  @IsString()
  marketStructure?: string;

  @IsOptional()
  @IsString()
  signalType?: string;

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
  @IsString()
  @IsIn(['Long', 'Short'])
  entryDirection?: string;

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
  @IsString()
  volumeProfileImage?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(3)
  hypothesisPaths?: string[];

  @IsOptional()
  @IsString()
  actualPath?: string;

  @IsOptional()
  @IsNumber()
  profitLoss?: number;

  @IsOptional()
  @IsString()
  rr?: string;

  @IsOptional()
  @IsString()
  analysisError?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  executionMindsetScore?: number;

  @IsOptional()
  @IsString()
  improvement?: string;
}