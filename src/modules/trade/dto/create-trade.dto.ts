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

// 交易类型枚举
export enum TradeType {
  SIMULATION = '模拟交易',
  REAL = '真实交易',
}

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

// 交易重要性分级枚举
export enum TradeGrade {
  HIGH = '高',
  MEDIUM = '中',
  LOW = '低',
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
    description: '退出信号',
    example: '价格跌破支撑位，成交量放大',
  })
  @IsString()
  @IsOptional()
  exitSignal: string;
}

export class CreateTradeDto {
  @ApiProperty({
    description: '行情分析时间',
    example: '2025-05-23T09:30:00+08:00',
    required: true,
  })
  @IsDateString({ strict: true })
  analysisTime: string;
  
  // ===== 交易类型 =====
  @ApiProperty({
    description: '交易类型',
    enum: TradeType,
    example: TradeType.SIMULATION,
    required: true,
  })
  @IsEnum(TradeType)
  tradeType: TradeType;

  // ===== 交易状态 =====
  @ApiProperty({
    description: '交易状态',
    enum: TradeStatus,
    example: TradeStatus.ANALYZED,
  })
  @IsEnum(TradeStatus)
  status: TradeStatus;

  // ===== 入场前分析 =====
  @ApiProperty({ 
    description: '成交量分布图，最多5张图', 
    type: [ImageResource],
    maxItems: 5
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageResource)
  @ArrayMaxSize(5)
  volumeProfileImages: ImageResource[];

  @ApiProperty({ description: '成交量分布图POC价格', example: 147.8 })
  @IsNumber()
  @Type(() => Number)
  poc: number;

  @ApiProperty({ description: '价值区下沿价格', example: 145.2 })
  @IsNumber()
  @Type(() => Number)
  val: number;

  @ApiProperty({ description: '价值区上沿价格', example: 150.5 })
  @IsNumber()
  @Type(() => Number)
  vah: number;

  @ApiProperty({ 
    description: '其他关键价格点', 
    example: '日内高点: 152.3\n日内低点: 144.8\n前日收盘: 146.2' 
  })
  @IsString()
  @IsOptional()
  keyPriceLevels: string;

  @ApiProperty({
    description: '市场结构判断',
    enum: MarketStructure,
    example: MarketStructure.BALANCED,
  })
  @IsEnum(MarketStructure)
  marketStructure: MarketStructure;

  @ApiProperty({
    description: '市场结构详细分析',
    example: '市场处于平衡状态，价格在价值区内震荡，成交量集中在中间价位',
  })
  @IsString()
  marketStructureAnalysis: string;

  @ApiProperty({ 
    description: '预计路径图片', 
    type: [ImageResource],
    maxItems: 5
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageResource)
  @ArrayMaxSize(5)
  @IsOptional()
  expectedPathImages: ImageResource[];

  @ApiProperty({
    description: '预计路径分析',
    example: '预计价格将在价值区内震荡，随后向上突破价值区上沿',
  })
  @IsString()
  @IsOptional()
  expectedPathAnalysis: string;

  @ApiProperty({ 
    description: '入场计划A', 
    type: EntryPlan 
  })
  @ValidateNested()
  @Type(() => EntryPlan)
  entryPlanA: EntryPlan;

  @ApiProperty({ 
    description: '入场计划B', 
    type: EntryPlan 
  })
  @ValidateNested()
  @Type(() => EntryPlan)
  @IsOptional()
  entryPlanB: EntryPlan;

  @ApiProperty({ 
    description: '入场计划C', 
    type: EntryPlan 
  })
  @ValidateNested()
  @Type(() => EntryPlan)
  @IsOptional()
  entryPlanC: EntryPlan;

  // ===== 入场记录 =====
  @ApiProperty({ description: '入场价格', example: 146.5 })
  @IsNumber()
  @Type(() => Number)
  @ValidateIf(o => o.status === TradeStatus.ENTERED || o.status === TradeStatus.EXITED)
  entryPrice: number;

  @ApiProperty({
    description: '入场时间',
    example: '2025-05-23T09:30:00+08:00',
  })
  @IsDateString({ strict: true })
  @ValidateIf(o => o.status === TradeStatus.ENTERED || o.status === TradeStatus.EXITED)
  entryTime: string;

  @ApiProperty({
    description: '入场多空方向',
    enum: EntryDirection,
    example: EntryDirection.LONG,
  })
  @IsEnum(EntryDirection)
  @ValidateIf(o => o.status === TradeStatus.ENTERED || o.status === TradeStatus.EXITED)
  entryDirection: EntryDirection;

  @ApiProperty({ description: '止损点', example: 145.0 })
  @IsNumber()
  @Type(() => Number)
  @ValidateIf(o => o.status === TradeStatus.ENTERED || o.status === TradeStatus.EXITED)
  stopLoss: number;

  @ApiProperty({ description: '止盈点', example: 149.5 })
  @IsNumber()
  @Type(() => Number)
  @ValidateIf(o => o.status === TradeStatus.ENTERED || o.status === TradeStatus.EXITED)
  takeProfit: number;

  @ApiProperty({
    description: '入场理由',
    example: '价格回调至支撑位，并且成交量有收缩迹象',
  })
  @IsString()
  @ValidateIf(o => o.status === TradeStatus.ENTERED || o.status === TradeStatus.EXITED)
  entryReason: string;

  @ApiProperty({
    description: '离场理由',
    example: '价格达到目标位，成交量有很大的放大',
  })
  @IsString()
  @ValidateIf(o => o.status === TradeStatus.ENTERED || o.status === TradeStatus.EXITED)
  exitReason: string;

  @ApiProperty({
    description: '交易过程中心态记录',
    example: '入场后价格快速下跌，感到紧张但坚持止损点\n价格回升后感到放松，按计划持有',
  })
  @IsString()
  @ValidateIf(o => o.status === TradeStatus.ENTERED || o.status === TradeStatus.EXITED)
  mentalityNotes: string;

  // ===== 离场后分析 =====
  @ApiProperty({ description: '离场价格', example: 148.7 })
  @IsNumber()
  @Type(() => Number)
  @ValidateIf(o => o.status === TradeStatus.EXITED)
  exitPrice: number;

  @ApiProperty({
    description: '离场时间',
    example: '2025-05-23T14:30:00+08:00',
  })
  @IsDateString({ strict: true })
  @ValidateIf(o => o.status === TradeStatus.EXITED)
  exitTime: string;

  @ApiProperty({
    description: '交易结果',
    enum: TradeResult,
    example: TradeResult.PROFIT,
  })
  @IsEnum(TradeResult)
  @ValidateIf(o => o.status === TradeStatus.EXITED)
  tradeResult: TradeResult;

  @ApiProperty({
    description: '是否符合入场计划',
    example: true,
  })
  @IsBoolean()
  @ValidateIf(o => o.status === TradeStatus.EXITED)
  followedPlan: boolean;

  @ApiProperty({
    description: '所遵循的交易计划ID',
    example: 'planA',
  })
  @IsString()
  @ValidateIf(o => o.status === TradeStatus.EXITED && o.followedPlan === true)
  followedPlanId: string;

  @ApiProperty({ 
    description: '实际行情路径图片', 
    type: [ImageResource],
    maxItems: 5
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageResource)
  @ArrayMaxSize(5)
  @IsOptional()
  actualPathImages: ImageResource[];

  @ApiProperty({
    description: '实际行情路径分析',
    example: '价格如预期在价值区内震荡后向上突破，但突破力度不及预期',
  })
  @IsString()
  @ValidateIf(o => o.status === TradeStatus.EXITED)
  actualPathAnalysis: string;

  @ApiProperty({
    description: '备注',
    example: '这次交易整体执行较好，但离场时机可以更优化',
  })
  @IsString()
  @IsOptional()
  remarks: string;

  @ApiProperty({
    description: '需要总结的经验',
    example: '1. 在价值区内入场多单风险较小\n2. 应该更关注成交量变化\n3. 止盈可以分批设置',
  })
  @IsString()
  @IsOptional()
  lessonsLearned: string;

  @ApiProperty({ 
    description: '分析图，最多5张', 
    type: [ImageResource],
    maxItems: 5
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageResource)
  @ArrayMaxSize(5)
  @IsOptional()
  analysisImages: ImageResource[];

  // 保留一些基础计算字段
  @ApiProperty({ description: '盈亏百分比', example: 2.5 })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  profitLossPercentage: number;

  @ApiProperty({ description: '风险回报比', example: '1:3' })
  @IsString()
  @IsOptional()
  riskRewardRatio: string;

  // ========== 新增：交易重要性分级 ==========
  @ApiProperty({
    description: '交易分级，高/中/低',
    enum: TradeGrade,
    example: TradeGrade.MEDIUM,
    required: false
  })
  @IsEnum(TradeGrade)
  @IsOptional()
  grade: TradeGrade;

  // ========== 新增：分析是否过期 ==========
  @ApiProperty({
    description: '分析是否过期，由用户手动标记',
    example: false,
    required: false
  })
  @IsBoolean()
  @IsOptional()
  analysisExpired: boolean;
}
