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
} from './create-trade.dto';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTradeDto {
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

  @ApiProperty({
    description: '市场结构判断',
    enum: MarketStructure,
    example: MarketStructure.BALANCED,
    required: false
  })
  @IsOptional()
  @IsEnum(MarketStructure)
  marketStructure?: MarketStructure;

  @ApiProperty({
    description: '市场结构详细分析',
    example: '市场处于平衡状态，价格在价值区内震荡，成交量集中在中间价位',
    required: false
  })
  @IsOptional()
  @IsString()
  marketStructureAnalysis?: string;

  @ApiProperty({ 
    description: '预计路径图片', 
    type: [ImageResource],
    maxItems: 5,
    required: false
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageResource)
  @ArrayMaxSize(5)
  expectedPathImages?: ImageResource[];

  @ApiProperty({
    description: '预计路径分析',
    example: '预计价格将在价值区内震荡，随后向上突破价值区上沿',
    required: false
  })
  @IsOptional()
  @IsString()
  expectedPathAnalysis?: string;

  @ApiProperty({ 
    description: '入场计划A', 
    type: EntryPlan,
    required: false
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => EntryPlan)
  entryPlanA?: EntryPlan;

  @ApiProperty({ 
    description: '入场计划B', 
    type: EntryPlan,
    required: false
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => EntryPlan)
  entryPlanB?: EntryPlan;

  @ApiProperty({ 
    description: '入场计划C', 
    type: EntryPlan,
    required: false
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => EntryPlan)
  entryPlanC?: EntryPlan;

  // ===== 入场记录 =====
  @ApiProperty({ description: '入场价格', example: 146.5, required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  entryPrice?: number;

  @ApiProperty({
    description: '入场时间',
    example: '2025-05-23T09:30:00+08:00',
    required: false
  })
  @IsOptional()
  @IsDateString({ strict: true })
  entryTime?: string;

  @ApiProperty({
    description: '入场多空方向',
    enum: EntryDirection,
    example: EntryDirection.LONG,
    required: false
  })
  @IsOptional()
  @IsEnum(EntryDirection)
  entryDirection?: EntryDirection;

  @ApiProperty({ description: '止损点', example: 145.0, required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  stopLoss?: number;

  @ApiProperty({ description: '止盈点', example: 149.5, required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  takeProfit?: number;

  @ApiProperty({
    description: '入场理由',
    example: '价格回调至支撑位，并且成交量有收缩迹象',
    required: false
  })
  @IsOptional()
  @IsString()
  entryReason?: string;

  @ApiProperty({
    description: '离场理由',
    example: '价格达到目标位，成交量有很大的放大',
    required: false
  })
  @IsOptional()
  @IsString()
  exitReason?: string;

  @ApiProperty({
    description: '交易过程中心态记录',
    example: '入场后价格快速下跌，感到紧张但坚持止损点\n价格回升后感到放松，按计划持有',
    required: false
  })
  @IsOptional()
  @IsString()
  mentalityNotes?: string;

  // ===== 离场后分析 =====
  @ApiProperty({ description: '离场价格', example: 148.7, required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  exitPrice?: number;

  @ApiProperty({
    description: '离场时间',
    example: '2025-05-23T14:30:00+08:00',
    required: false
  })
  @IsOptional()
  @IsDateString({ strict: true })
  exitTime?: string;

  @ApiProperty({
    description: '交易结果',
    enum: TradeResult,
    example: TradeResult.PROFIT,
    required: false
  })
  @IsOptional()
  @IsEnum(TradeResult)
  tradeResult?: TradeResult;

  @ApiProperty({
    description: '是否符合入场计划',
    example: true,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  followedPlan?: boolean;

  @ApiProperty({
    description: '所遵循的交易计划ID',
    example: 'planA',
    required: false
  })
  @IsOptional()
  @IsString()
  @ValidateIf(o => o.followedPlan === true)
  followedPlanId?: string;

  @ApiProperty({ 
    description: '实际行情路径图片', 
    type: [ImageResource],
    maxItems: 5,
    required: false
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageResource)
  @ArrayMaxSize(5)
  actualPathImages?: ImageResource[];

  @ApiProperty({
    description: '实际行情路径分析',
    example: '价格如预期在价值区内震荡后向上突破，但突破力度不及预期',
    required: false
  })
  @IsOptional()
  @IsString()
  actualPathAnalysis?: string;

  @ApiProperty({
    description: '备注',
    example: '这次交易整体执行较好，但离场时机可以更优化',
    required: false
  })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiProperty({
    description: '需要总结的经验',
    example: '1. 在价值区内入场多单风险较小\n2. 应该更关注成交量变化\n3. 止盈可以分批设置',
    required: false
  })
  @IsOptional()
  @IsString()
  lessonsLearned?: string;

  @ApiProperty({ 
    description: '分析图，最多5张', 
    type: [ImageResource],
    maxItems: 5,
    required: false
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageResource)
  @ArrayMaxSize(5)
  analysisImages?: ImageResource[];

  // 保留一些基础计算字段
  @ApiProperty({ description: '盈亏百分比', example: 2.5, required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  profitLossPercentage?: number;

  @ApiProperty({ description: '风险回报比', example: '1:3', required: false })
  @IsOptional()
  @IsString()
  riskRewardRatio?: string;
}
