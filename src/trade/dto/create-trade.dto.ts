import { IsString, IsArray, IsNumber, IsOptional, IsIn, ArrayMaxSize, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTradeDto {
  @IsString()
  dateTimeRange: string; // 日期/时间段

  @IsString()
  marketStructure: string; // 市场结构判断

  @IsString()
  signalType: string; // 信号类型

  @IsNumber()
  @Type(() => Number)
  vah: number; // 价值区上沿价格

  @IsNumber()
  @Type(() => Number)
  val: number; // 价值区下沿价格

  @IsNumber()
  @Type(() => Number)
  poc: number; // 成交量中枢价位

  @IsString()
  @IsIn(['Long', 'Short'])
  entryDirection: string; // 多空方向

  @IsNumber()
  @Type(() => Number)
  entry: number; // 入场价格 (对应 README 中的 EntryPrice)

  @IsNumber()
  @Type(() => Number)
  stopLoss: number; // 止损价格 (对应 README 中的 StopLossPrice)

  @IsNumber()
  @Type(() => Number)
  target: number; // 止盈目标价格 (对应 README 中的 TargetPrice)

  @IsString()
  volumeProfileImage: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(3)
  hypothesisPaths: string[]; // 假设路径 A/B/C

  @IsString()
  actualPath: string;

  @IsNumber()
  @Type(() => Number)
  profitLoss: number; // 盈亏百分比 (对应 README 中的 PnLPercent)

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