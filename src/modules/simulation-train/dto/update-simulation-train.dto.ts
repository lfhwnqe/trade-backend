import {
  IsString,
  IsArray,
  IsNumber,
  IsOptional,
  ArrayMaxSize,
  Min,
  Max,
  IsEnum,
  ValidateNested,
  IsDateString,
  IsBoolean,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  MarketStructure,
  EntryDirection,
  TradeResult,
  TradeStatus,
  ImageResource,
  EntryPlan,
} from './create-simulation-train.dto';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSimulationTrainDto {
  @ApiProperty({
    description: '行情分析时间',
    example: '2025-05-23T09:30:00+08:00',
    required: true,
  })
  @IsDateString({ strict: true })
  analysisTime: string;
  
  // ===== 交易状态 =====
  @ApiProperty({ 
    description: '交易状态',
    enum: TradeStatus,
    example: TradeStatus.ANALYZED,
    required: false
  })
  @IsOptional()
  @IsEnum(TradeStatus)
  status?: TradeStatus;

  // ===== 入场前分析 =====
  @ApiProperty({ 
    description: '成交量分布图，最多5张图', 
    type: [ImageResource],
    maxItems: 5,
    required: false
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageResource)
  @ArrayMaxSize(5)
  volumeProfileImages?: ImageResource[];

  @ApiProperty({ description: '成交量分布图POC价格', example: 147.8, required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  poc?: number;

  @ApiProperty({ description: '价值区下沿价格', example: 145.2, required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  val?: number;

  @ApiProperty({ description: '价值区上沿价格', example: 150.5, required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  vah?: number;

  @ApiProperty({ 
    description: '其他关键价格点', 
    example: '日内高点: 152.3\n日内低点: 144.8\n前日收盘: 146.2',
    required: false
  })
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
  @Type(() => Number)
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
  @Type(() => Number)
  stopLoss?: number;

  @ApiProperty({ description: '止盈点', required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
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
  @Type(() => Number)
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
  @Type(() => Number)
  profitLossPercentage?: number;

  @ApiProperty({ description: '风险回报比', required: false })
  @IsOptional()
  @IsString()
  riskRewardRatio?: string;
}