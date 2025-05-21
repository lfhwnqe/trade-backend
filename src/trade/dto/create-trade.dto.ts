import { IsString, IsArray, IsNumber, IsOptional, IsIn, ArrayMaxSize, Min, Max } from 'class-validator';

export class CreateTradeDto {
  @IsString()
  dateTimeRange: string; // 日期/时间段

  @IsString()
  marketStructure: string; // 市场结构判断

  @IsString()
  signalType: string; // 信号类型

  @IsString()
  vah: string;

  @IsString()
  val: string;

  @IsString()
  poc: string;

  @IsString()
  entry: string;

  @IsString()
  stopLoss: string;

  @IsString()
  target: string;

  @IsString()
  volumeProfileImage: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(3)
  hypothesisPaths: string[]; // 假设路径 A/B/C

  @IsString()
  actualPath: string;

  @IsString()
  profitLoss: string;

  @IsString()
  rr: string;

  @IsString()
  analysisError: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  executionMindsetScore: number;

  @IsString()
  improvement: string;
}