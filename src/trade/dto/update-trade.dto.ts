import { IsString, IsArray, IsNumber, IsOptional, ArrayMaxSize, Min, Max } from 'class-validator';

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
  @IsString()
  vah?: string;

  @IsOptional()
  @IsString()
  val?: string;

  @IsOptional()
  @IsString()
  poc?: string;

  @IsOptional()
  @IsString()
  entry?: string;

  @IsOptional()
  @IsString()
  stopLoss?: string;

  @IsOptional()
  @IsString()
  target?: string;

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
  @IsString()
  profitLoss?: string;

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