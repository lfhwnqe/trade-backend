import { IsString, IsArray, IsNumber, IsOptional, IsIn, ArrayMaxSize, Min, Max, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// 市场结构枚举
export enum MarketStructure {
  BALANCED = '平衡',
  IMBALANCED = '失衡',
  UNSEEN = '未见过'
}

// 入场方向枚举
export enum EntryDirection {
  LONG = '多',
  SHORT = '空'
}

// 图片资源接口
export class ImageResource {
  @IsString()
  key: string; // AWS CloudFront 资源 ID/键值，用于删除资源
  
  @IsString()
  url: string; // 图片完整 URL
}

export class CreateTradeDto {
  @IsString()
  dateTimeRange: string; // 日期/时间段

  @IsEnum(MarketStructure)
  marketStructure: MarketStructure; // 市场结构判断 枚举： 平衡/失衡/未见过

  // signalType 字段已删除，不再需要

  @IsNumber()
  @Type(() => Number)
  vah: number; // 价值区上沿价格

  @IsNumber()
  @Type(() => Number)
  val: number; // 价值区下沿价格

  @IsNumber()
  @Type(() => Number)
  poc: number; // 成交量中枢价位

  @IsEnum(EntryDirection)
  entryDirection: EntryDirection; // 入场多空方向 枚举：多/空

  @IsNumber()
  @Type(() => Number)
  entry: number; // 入场价格 (对应 README 中的 EntryPrice)

  @IsNumber()
  @Type(() => Number)
  stopLoss: number; // 止损价格 (对应 README 中的 StopLossPrice)
  
  @IsNumber()
  @Type(() => Number)
  target: number; // 止盈目标价格 (对应 README 中的 TargetPrice)
  
  @IsNumber()
  @Type(() => Number)
  exit: number; // 离场价格 (对应 README 中的 ExitPrice)

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageResource)
  volumeProfileImage: ImageResource[]; // 成交量分布图，多张图，包含aws cloudfront的资源id，方便后续删除

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageResource)
  @ArrayMaxSize(3)
  hypothesisPaths: ImageResource[]; // 假设路径 A/B/C，多张图，包含aws cloudfront的资源id

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageResource)
  actualPath: ImageResource[]; // 实际路径，多张图，包含aws cloudfront的资源id，方便后续删除

  @IsNumber()
  @Type(() => Number)
  profitLoss: number; // 盈亏百分比 (对应 README 中的 PnLPercent)

  @IsString()
  rr: string; // 风险回报比

  @IsString()
  analysisResult: string; // 分析结果

  @IsNumber()
  @Min(1)
  @Max(5)
  executionMindsetScore: number;

  @IsString()
  improvement: string; // 改进措施
}