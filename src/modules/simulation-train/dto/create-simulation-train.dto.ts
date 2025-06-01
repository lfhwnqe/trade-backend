import {
  IsString,
  IsArray,
  IsNumber,
  ArrayMaxSize,
  Min,
  Max,
  IsEnum,
  ValidateNested,
  IsDateString,
  IsBoolean,
  IsOptional,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

// 市场结构枚举
export enum MarketStructure {
  BALANCED = '震荡',
  IMBALANCED = '趋势',
  UNSEEN = '暂无法判断',
}

// 入场方向枚举
export enum EntryDirection {
  LONG = '多',
  SHORT = '空',
}

// 交易结果枚举
export enum TradeResult {
  PROFIT = '盈利',
  LOSS = '亏损',
  BREAKEVEN = '保本',
}

// 交易记录状态枚举
export enum TradeStatus {
  ANALYZED = '已分析',
  ENTERED = '已入场',
  EXITED = '已离场',
}

// 图片资源接口
export class ImageResource {
  @ApiProperty({
    description: 'AWS CloudFront 资源 ID/键值，用于删除资源',
    example: 'images/2023-05-23/user123/image1.jpg',
  })
  @IsString()
  key: string;

  @ApiProperty({
    description: '图片完整 URL',
    example: 'https://example.com/images/image1.jpg',
  })
  @IsString()
  url: string;
}

// 入场计划接口
export class EntryPlan {
  @ApiProperty({
    description: '入场理由',
    example: '价格回调至支撑位，成交量减少，预计反弹',
  })
  @IsString()
  @IsOptional()
  entryReason: string;

  @ApiProperty({
    description: '入场信号',
    example: '价格突破前高，成交量放大',
  })
  @IsString()
  @IsOptional()
  entrySignal: string;

  @ApiProperty({
    description: '入场价格',
    example: 100.5,
  })
  @IsNumber()
  @IsOptional()
  entryPrice: number;

  @ApiProperty({
    description: '止损',
    example: 98,
  })
  @IsNumber()
  @IsOptional()
  stopLoss: number;

  @ApiProperty({
    description: '止盈',
    example: 110,
  })
  @IsNumber()
  @IsOptional()
  takeProfit: number;
}

export class CreateSimulationTrainDto {
  @ApiProperty({ description: '行情分析时间', example: '2025-06-01T09:00:00.000Z', required: false })
  @IsOptional()
  @IsDateString()
  analysisTime?: string;

  // ===== 唯一ID与用户ID由系统生成，无需客户端填写 =====
  // simulationTrainId 由后端生成
  // userId 通过请求鉴权获取

  @ApiProperty({ description: '交易状态', enum: TradeStatus })
  @IsEnum(TradeStatus)
  status: TradeStatus;

  @ApiProperty({
    description: '成交量分布图，最多5张图',
    type: [ImageResource],
    required: false,
  })
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ImageResource)
  @IsOptional()
  volumeProfileImages?: ImageResource[];

  @ApiProperty({ description: '成交量分布图POC价格', example: 100.01, required: false })
  @IsOptional()
  @IsNumber()
  poc?: number;

  @ApiProperty({ description: '价值区下沿价格', example: 95, required: false })
  @IsOptional()
  @IsNumber()
  val?: number;

  @ApiProperty({ description: '价值区上沿价格', example: 110, required: false })
  @IsOptional()
  @IsNumber()
  vah?: number;

  @ApiProperty({ description: '其他关键价格点', required: false })
  @IsOptional()
  @IsString()
  keyPriceLevels?: string;

  @ApiProperty({ description: '市场结构判断', enum: MarketStructure })
  @IsEnum(MarketStructure)
  marketStructure: MarketStructure;

  @ApiProperty({ description: '市场结构详细分析', required: false })
  @IsOptional()
  @IsString()
  marketStructureAnalysis?: string;

  @ApiProperty({
    description: '预计路径图片',
    type: [ImageResource],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageResource)
  expectedPathImages?: ImageResource[];

  @ApiProperty({ description: '预计路径分析', required: false })
  @IsOptional()
  @IsString()
  expectedPathAnalysis?: string;

  @ApiProperty({ description: '入场计划A', type: EntryPlan })
  @ValidateNested()
  @Type(() => EntryPlan)
  entryPlanA: EntryPlan;

  @ApiProperty({ description: '入场计划B', type: EntryPlan, required: false })
  @ValidateNested()
  @Type(() => EntryPlan)
  @IsOptional()
  entryPlanB?: EntryPlan;

  @ApiProperty({ description: '入场计划C', type: EntryPlan, required: false })
  @ValidateNested()
  @Type(() => EntryPlan)
  @IsOptional()
  entryPlanC?: EntryPlan;

  // ===== 入场记录 =====
  @ApiProperty({ description: '入场价格', required: false })
  @IsOptional()
  @IsNumber()
  entryPrice?: number;

  @ApiProperty({ description: '入场时间', required: false })
  @IsOptional()
  @IsDateString()
  entryTime?: string;

  @ApiProperty({ description: '多空方向', enum: EntryDirection, required: false })
  @IsOptional()
  @IsEnum(EntryDirection)
  entryDirection?: EntryDirection;

  @ApiProperty({ description: '止损点', required: false })
  @IsOptional()
  @IsNumber()
  stopLoss?: number;

  @ApiProperty({ description: '止盈点', required: false })
  @IsOptional()
  @IsNumber()
  takeProfit?: number;

  @ApiProperty({ description: '入场理由', required: false })
  @IsOptional()
  @IsString()
  entryReason?: string;

  @ApiProperty({ description: '离场理由', required: false })
  @IsOptional()
  @IsString()
  exitReason?: string;

  @ApiProperty({ description: '交易过程中心态记录', required: false })
  @IsOptional()
  @IsString()
  mentalityNotes?: string;

  // ===== 离场后分析 =====
  @ApiProperty({ description: '离场价格', required: false })
  @IsOptional()
  @IsNumber()
  exitPrice?: number;

  @ApiProperty({ description: '离场时间', required: false })
  @IsOptional()
  @IsDateString()
  exitTime?: string;

  @ApiProperty({ description: '交易结果', enum: TradeResult, required: false })
  @IsOptional()
  @IsEnum(TradeResult)
  tradeResult?: TradeResult;

  @ApiProperty({ description: '是否符合入场计划', required: false })
  @IsOptional()
  @IsBoolean()
  followedPlan?: boolean;

  @ApiProperty({ description: '所遵循的交易计划ID', required: false })
  @IsOptional()
  @IsString()
  followedPlanId?: string;

  @ApiProperty({
    description: '实际行情路径图片',
    type: [ImageResource],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageResource)
  actualPathImages?: ImageResource[];

  @ApiProperty({ description: '实际行情路径分析', required: false })
  @IsOptional()
  @IsString()
  actualPathAnalysis?: string;

  @ApiProperty({ description: '备注', required: false })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiProperty({ description: '需要总结的经验', required: false })
  @IsOptional()
  @IsString()
  lessonsLearned?: string;

  @ApiProperty({
    description: '分析图',
    type: [ImageResource],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageResource)
  analysisImages?: ImageResource[];

  // 基础计算字段
  @ApiProperty({ description: '盈亏百分比', required: false })
  @IsOptional()
  @IsNumber()
  profitLossPercentage?: number;

  @ApiProperty({ description: '风险回报比', required: false })
  @IsOptional()
  @IsString()
  riskRewardRatio?: string;
}