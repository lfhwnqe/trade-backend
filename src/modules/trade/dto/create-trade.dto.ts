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
  STOP = '停止',
  TRANSITION = '转换',
}

// 入场方向枚举
export enum EntryDirection {
  LONG = '多',
  SHORT = '空',
}

// 交易结果枚举
export enum TradeResult {
  PROFIT = 'PROFIT',
  LOSS = 'LOSS',
  BREAKEVEN = 'BREAKEVEN',
}

// 离场类型（用于执行质量统计）
export enum ExitType {
  TP = 'TP',
  SL = 'SL',
  MANUAL = 'MANUAL',
  TIME = 'TIME',
  FORCED = 'FORCED',
}

// 离场质量标签
export enum ExitQualityTag {
  TECHNICAL = 'TECHNICAL',
  EMOTIONAL = 'EMOTIONAL',
  SYSTEM = 'SYSTEM',
  UNKNOWN = 'UNKNOWN',
}

// 交易记录状态枚举
export enum TradeStatus {
  ANALYZED = '已分析',
  WAITING = '待入场',
  ENTERED = '已入场',
  EXITED = '已离场',
  EARLY_EXITED = '提前离场',
  ANALYZED_NOT_ENTERED = '未入场', // 新增的状态
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

export class MarketStructureAnalysisImage {
  @ApiProperty({
    description: '图片资源',
    type: ImageResource,
  })
  @ValidateNested()
  @Type(() => ImageResource)
  image: ImageResource;

  @ApiProperty({
    description: '图片标题',
    example: '15分钟市场结构图',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: '图片解析',
    example: '价格在区间内震荡，成交量集中在中间价位',
  })
  @IsString()
  analysis: string;
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

export class ChecklistState {
  @ApiProperty({
    description: '阶段分析：判断当前行情所处阶段（震荡/趋势）',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  phaseAnalysis?: boolean;

  @ApiProperty({
    description: '震荡阶段：关键阻力点、VWAP位置、威科夫区间边缘与小溪测试行为',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  rangeAnalysis?: boolean;

  @ApiProperty({
    description: '趋势阶段：最近高成交量节点（可能回调测试点/入场价格）',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  trendAnalysis?: boolean;

  @ApiProperty({
    description: '盈亏比计算是否完成',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  riskRewardCheck?: boolean;
}

export const ANALYSIS_PERIOD_PRESETS = [
  '15分钟',
  '30分钟',
  '1小时',
  '4小时',
  '1天',
] as const;

export class CreateTradeDto {
  @ApiProperty({
    description: '行情分析时间',
    example: '2025-05-23T09:30:00+08:00',
    required: true,
  })
  @IsDateString({ strict: true })
  analysisTime: string;

  @ApiProperty({
    description:
      '分析周期（可选：15分钟/30分钟/1小时/4小时/1天，也可自定义输入）',
    example: '1小时',
    required: false,
  })
  @IsOptional()
  @IsString()
  analysisPeriod?: string;

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
    description: '成交量分布图（旧字段），最多5张图',
    type: [ImageResource],
    maxItems: 5,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageResource)
  @ArrayMaxSize(5)
  volumeProfileImages?: ImageResource[];

  @ApiProperty({
    description: '市场结构分析图片，最多5张图',
    type: [MarketStructureAnalysisImage],
    maxItems: 5,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarketStructureAnalysisImage)
  @ArrayMaxSize(5)
  marketStructureAnalysisImages?: MarketStructureAnalysisImage[];

  @ApiProperty({
    description: '走势分析图（市场结构分析后的走势），最多5张图',
    type: [MarketStructureAnalysisImage],
    maxItems: 5,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarketStructureAnalysisImage)
  @ArrayMaxSize(5)
  trendAnalysisImages?: MarketStructureAnalysisImage[];

  @ApiProperty({
    description: '成交量分布图POC价格',
    example: 147.8,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  poc?: number;

  @ApiProperty({
    description: '价值区下沿价格',
    example: 145.2,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  val?: number;

  @ApiProperty({
    description: '价值区上沿价格',
    example: 150.5,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  vah?: number;

  @ApiProperty({
    description: '其他关键价格点',
    example: '日内高点: 152.3\n日内低点: 144.8\n前日收盘: 146.2',
  })
  @IsString()
  @IsOptional()
  keyPriceLevels: string;

  @ApiProperty({
    description: '交易标的',
    example: 'eth',
  })
  @IsString()
  tradeSubject: string;

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
    description: '入场前分析总结',
    example: '当前市场结构偏平衡，关注价值区上沿突破机会',
    required: false,
  })
  @IsString()
  @IsOptional()
  preEntrySummary: string;

  @ApiProperty({
    description: '预计路径图片，最多5张图',
    type: [ImageResource],
    maxItems: 5,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageResource)
  @ArrayMaxSize(5)
  @IsOptional()
  expectedPathImages: ImageResource[];

  @ApiProperty({
    description: '预计路径图片（新字段，含标题与解析），最多5张图',
    type: [MarketStructureAnalysisImage],
    maxItems: 5,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarketStructureAnalysisImage)
  @ArrayMaxSize(5)
  expectedPathImagesDetailed?: MarketStructureAnalysisImage[];

  @ApiProperty({
    description: '预计路径分析',
    example: '预计价格将在价值区内震荡，随后向上突破价值区上沿',
  })
  @IsString()
  @IsOptional()
  expectedPathAnalysis: string;

  @ApiProperty({
    description: '入场计划A',
    type: EntryPlan,
  })
  @ValidateNested()
  @Type(() => EntryPlan)
  entryPlanA: EntryPlan;

  @ApiProperty({
    description: '入场计划B',
    type: EntryPlan,
  })
  @ValidateNested()
  @Type(() => EntryPlan)
  @IsOptional()
  entryPlanB: EntryPlan;

  @ApiProperty({
    description: '入场计划C',
    type: EntryPlan,
  })
  @ValidateNested()
  @Type(() => EntryPlan)
  @IsOptional()
  entryPlanC: EntryPlan;

  @ApiProperty({
    description: '入场前总结重要性评分（1-5）',
    example: 3,
    required: false,
  })
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(5)
  @IsOptional()
  preEntrySummaryImportance: number;

  // ===== 入场前检查 =====
  @ApiProperty({
    description: '入场前检查清单（待入场状态可填写）',
    type: ChecklistState,
    required: false,
  })
  @ValidateNested()
  @Type(() => ChecklistState)
  @IsOptional()
  checklist?: ChecklistState;

  // ===== 入场记录 =====
  @ApiProperty({ description: '入场价格', example: 146.5 })
  @IsNumber()
  @Type(() => Number)
  @ValidateIf(
    (o) =>
      o.status === TradeStatus.ENTERED ||
      o.status === TradeStatus.EXITED ||
      o.status === TradeStatus.EARLY_EXITED,
  )
  entryPrice: number;

  @ApiProperty({
    description: '入场时间',
    example: '2025-05-23T09:30:00+08:00',
  })
  @IsDateString({ strict: true })
  @ValidateIf(
    (o) =>
      o.status === TradeStatus.ENTERED ||
      o.status === TradeStatus.EXITED ||
      o.status === TradeStatus.EARLY_EXITED,
  )
  entryTime: string;

  @ApiProperty({
    description: '入场多空方向',
    enum: EntryDirection,
    example: EntryDirection.LONG,
  })
  @IsEnum(EntryDirection)
  @ValidateIf(
    (o) =>
      o.status === TradeStatus.ENTERED ||
      o.status === TradeStatus.EXITED ||
      o.status === TradeStatus.EARLY_EXITED,
  )
  entryDirection: EntryDirection;

  @ApiProperty({ description: '止损点', example: 145.0 })
  @IsNumber()
  @Type(() => Number)
  @ValidateIf(
    (o) =>
      o.status === TradeStatus.ENTERED ||
      o.status === TradeStatus.EXITED ||
      o.status === TradeStatus.EARLY_EXITED,
  )
  stopLoss: number;

  @ApiProperty({ description: '止盈点', example: 149.5 })
  @IsNumber()
  @Type(() => Number)
  @ValidateIf(
    (o) =>
      o.status === TradeStatus.ENTERED ||
      o.status === TradeStatus.EXITED ||
      o.status === TradeStatus.EARLY_EXITED,
  )
  takeProfit: number;

  @ApiProperty({
    description: '入场理由',
    example: '价格回调至支撑位，并且成交量有收缩迹象',
  })
  @IsString()
  @ValidateIf(
    (o) =>
      o.status === TradeStatus.ENTERED ||
      o.status === TradeStatus.EXITED ||
      o.status === TradeStatus.EARLY_EXITED,
  )
  entryReason: string;

  @ApiProperty({
    description: '离场理由',
    example: '价格达到目标位，成交量有很大的放大',
  })
  @IsString()
  @ValidateIf(
    (o) =>
      o.status === TradeStatus.ENTERED ||
      o.status === TradeStatus.EXITED ||
      o.status === TradeStatus.EARLY_EXITED,
  )
  exitReason: string;

  @ApiProperty({
    description: '提前离场原因',
    example: '风险事件触发，提前止损离场',
    required: false,
  })
  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.status === TradeStatus.EARLY_EXITED)
  earlyExitReason?: string;

  @ApiProperty({
    description: '交易过程中心态记录',
    example:
      '入场后价格快速下跌，感到紧张但坚持止损点\n价格回升后感到放松，按计划持有',
  })
  @IsString()
  @ValidateIf(
    (o) =>
      o.status === TradeStatus.ENTERED ||
      o.status === TradeStatus.EXITED ||
      o.status === TradeStatus.EARLY_EXITED,
  )
  mentalityNotes: string;

  @ApiProperty({
    description: '已入场分析图，最多5张',
    type: [ImageResource],
    maxItems: 10,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageResource)
  @ArrayMaxSize(10)
  entryAnalysisImages?: ImageResource[];

  @ApiProperty({
    description: '已入场分析图（新字段，含标题与解析），最多10张',
    type: [MarketStructureAnalysisImage],
    maxItems: 10,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarketStructureAnalysisImage)
  @ArrayMaxSize(10)
  entryAnalysisImagesDetailed?: MarketStructureAnalysisImage[];

  // ===== 离场后分析 =====
  @ApiProperty({ description: '离场价格', example: 148.7 })
  @IsNumber()
  @Type(() => Number)
  @ValidateIf(
    (o) =>
      o.status === TradeStatus.EXITED || o.status === TradeStatus.EARLY_EXITED,
  )
  exitPrice: number;

  @ApiProperty({
    description: '离场时间',
    example: '2025-05-23T14:30:00+08:00',
  })
  @IsDateString({ strict: true })
  @ValidateIf(
    (o) =>
      o.status === TradeStatus.EXITED || o.status === TradeStatus.EARLY_EXITED,
  )
  exitTime: string;

  @ApiProperty({
    description: '交易结果',
    enum: TradeResult,
    example: TradeResult.PROFIT,
  })
  @IsEnum(TradeResult)
  @ValidateIf(
    (o) =>
      o.status === TradeStatus.EXITED || o.status === TradeStatus.EARLY_EXITED,
  )
  tradeResult: TradeResult;

  @ApiProperty({
    description: '是否符合入场计划',
    example: true,
  })
  @IsBoolean()
  @ValidateIf(
    (o) =>
      o.status === TradeStatus.EXITED || o.status === TradeStatus.EARLY_EXITED,
  )
  followedPlan: boolean;

  @ApiProperty({
    description: '所遵循的交易计划ID',
    example: 'planA',
  })
  @IsString()
  @ValidateIf(
    (o) =>
      (o.status === TradeStatus.EXITED ||
        o.status === TradeStatus.EARLY_EXITED) &&
      o.followedPlan === true,
  )
  followedPlanId: string;

  @ApiProperty({
    description: '实际行情路径图片',
    type: [ImageResource],
    maxItems: 5,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageResource)
  @ArrayMaxSize(10)
  @IsOptional()
  actualPathImages: ImageResource[];

  @ApiProperty({
    description: '实际行情路径图片（新字段，含标题与解析），最多5张',
    type: [MarketStructureAnalysisImage],
    maxItems: 5,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarketStructureAnalysisImage)
  @ArrayMaxSize(5)
  actualPathImagesDetailed?: MarketStructureAnalysisImage[];

  @ApiProperty({
    description: '实际行情路径分析',
    example: '价格如预期在价值区内震荡后向上突破，但突破力度不及预期',
  })
  @IsString()
  @ValidateIf(
    (o) =>
      o.status === TradeStatus.EXITED || o.status === TradeStatus.EARLY_EXITED,
  )
  actualPathAnalysis: string;

  @ApiProperty({
    description: '交易标签（用户自定义，用于回测/统计）',
    example: ['突破', '趋势跟随'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tradeTags?: string[];

  @ApiProperty({
    description: '备注',
    example: '这次交易整体执行较好，但离场时机可以更优化',
  })
  @IsString()
  @IsOptional()
  remarks: string;

  @ApiProperty({
    description: '需要总结的经验',
    example:
      '1. 在价值区内入场多单风险较小\n2. 应该更关注成交量变化\n3. 止盈可以分批设置',
  })
  @IsString()
  @IsOptional()
  lessonsLearned: string;

  @ApiProperty({
    description: '交易完成后总结重要性评分（1-5）',
    example: 4,
    required: false,
  })
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(5)
  @IsOptional()
  lessonsLearnedImportance: number;

  @ApiProperty({
    description: '分析图，最多5张',
    type: [ImageResource],
    maxItems: 5,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageResource)
  @ArrayMaxSize(10)
  @IsOptional()
  analysisImages: ImageResource[];

  @ApiProperty({
    description: '分析图（新字段，含标题与解析），最多5张',
    type: [MarketStructureAnalysisImage],
    maxItems: 5,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarketStructureAnalysisImage)
  @ArrayMaxSize(5)
  analysisImagesDetailed?: MarketStructureAnalysisImage[];

  // ===== R 模型（计划层） =====
  @ApiProperty({ description: '风险模型版本', example: 'r-v1', required: false })
  @IsOptional()
  @IsString()
  riskModelVersion?: string;


  @ApiProperty({ description: '计划风险金额（可选）', example: 100, required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  plannedRiskAmount?: number;

  @ApiProperty({ description: '计划风险占比（可选）', example: 1, required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  plannedRiskPct?: number;

  // ===== R 模型（自动计算字段） =====
  @ApiProperty({ description: '计划每单位风险', required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  plannedRiskPerUnit?: number;

  @ApiProperty({ description: '计划每单位收益', required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  plannedRewardPerUnit?: number;

  @ApiProperty({ description: '计划盈亏比（R）', required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  plannedRR?: number;

  @ApiProperty({ description: '实现R（离场后自动计算）', required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  realizedR?: number;

  @ApiProperty({ description: 'R效率（实现R/计划R）', required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  rEfficiency?: number;

  @ApiProperty({ description: '离场偏差R（计划R-实现R）', required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  exitDeviationR?: number;

  @ApiProperty({ description: 'MFE（R）', required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxFavorableExcursionR?: number;

  @ApiProperty({ description: 'MAE（R）', required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxAdverseExcursionR?: number;

  @ApiProperty({ description: '离场类型', enum: ExitType, required: false })
  @IsOptional()
  @IsEnum(ExitType)
  exitType?: ExitType;

  @ApiProperty({ description: '离场质量标签', enum: ExitQualityTag, required: false })
  @IsOptional()
  @IsEnum(ExitQualityTag)
  exitQualityTag?: ExitQualityTag;

  @ApiProperty({ description: '离场原因代码', required: false })
  @IsOptional()
  @IsString()
  exitReasonCode?: string;

  @ApiProperty({ description: '离场原因备注', required: false })
  @IsOptional()
  @IsString()
  exitReasonNote?: string;

  @ApiProperty({ description: 'R指标是否可用', required: false })
  @IsOptional()
  @IsBoolean()
  rMetricsReady?: boolean;

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

  @ApiProperty({
    description: '是否严格遵守交易系统',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  followedSystemStrictly?: boolean;

  // ========== 新增：交易重要性分级 ==========
  @ApiProperty({
    description: '交易分级，高/中/低',
    enum: TradeGrade,
    example: TradeGrade.MEDIUM,
    required: false,
  })
  @IsEnum(TradeGrade)
  @IsOptional()
  grade: TradeGrade;

  // ========== 新增：分析是否过期 ==========
  @ApiProperty({
    description: '分析是否过期，由用户手动标记',
    example: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  analysisExpired: boolean;
}
