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
  MarketStructureAnalysisImage,
  EntryPlan,
  TradeType,
  ChecklistState,
} from './create-trade.dto';
import { TradeGrade } from './create-trade.dto';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTradeDto {
  @ApiProperty({
    description: '交易类型',
    enum: TradeType,
    example: TradeType.SIMULATION,
    required: false,
  })
  @IsOptional()
  @IsEnum(TradeType)
  tradeType?: TradeType;

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

  @ApiProperty({
    description: '交易标的',
    example: 'eth',
  })
  @IsString()
  tradeSubject: string;

  // ===== 交易状态 =====
  @ApiProperty({
    description: '交易状态',
    enum: TradeStatus,
    example: TradeStatus.ANALYZED,
    required: false,
  })
  @IsOptional()
  @IsEnum(TradeStatus)
  status?: TradeStatus;

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

  // ========== 新增：交易重要性分级 ==========
  @ApiProperty({
    description: '交易分级，高/中/低',
    enum: TradeGrade,
    example: TradeGrade.MEDIUM,
    required: false,
  })
  @IsOptional()
  @IsEnum(TradeGrade)
  grade?: TradeGrade;

  // ========== 新增：分析是否过期 ==========
  @ApiProperty({
    description: '分析是否过期，由用户手动标记',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  analysisExpired?: boolean;

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
    required: false,
  })
  @IsOptional()
  @IsString()
  keyPriceLevels?: string;

  @ApiProperty({
    description: '市场结构判断',
    enum: MarketStructure,
    example: MarketStructure.BALANCED,
    required: false,
  })
  @IsOptional()
  @IsEnum(MarketStructure)
  marketStructure?: MarketStructure;

  @ApiProperty({
    description: '市场结构详细分析',
    example: '市场处于平衡状态，价格在价值区内震荡，成交量集中在中间价位',
    required: false,
  })
  @IsOptional()
  @IsString()
  marketStructureAnalysis?: string;

  @ApiProperty({
    description: '入场前分析总结',
    example: '当前市场结构偏平衡，关注价值区上沿突破机会',
    required: false,
  })
  @IsOptional()
  @IsString()
  preEntrySummary?: string;

  @ApiProperty({
    description: '预计路径图片，最多5张图',
    type: [ImageResource],
    maxItems: 5,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageResource)
  @ArrayMaxSize(5)
  expectedPathImages?: ImageResource[];

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
    required: false,
  })
  @IsOptional()
  @IsString()
  expectedPathAnalysis?: string;

  @ApiProperty({
    description: '入场计划A',
    type: EntryPlan,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => EntryPlan)
  entryPlanA?: EntryPlan;

  @ApiProperty({
    description: '入场计划B',
    type: EntryPlan,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => EntryPlan)
  entryPlanB?: EntryPlan;

  @ApiProperty({
    description: '入场计划C',
    type: EntryPlan,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => EntryPlan)
  entryPlanC?: EntryPlan;

  @ApiProperty({
    description: '入场前总结重要性评分（1-5）',
    example: 3,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(5)
  preEntrySummaryImportance?: number;

  // ===== 入场前检查 =====
  @ApiProperty({
    description: '入场前检查清单（待入场状态可填写）',
    type: ChecklistState,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ChecklistState)
  checklist?: ChecklistState;

  // ===== 入场记录 =====
  @ApiProperty({ description: '入场价格', example: 146.5, required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  entryPrice?: number;

  @ApiProperty({
    description: '入场时间',
    example: '2025-05-23T09:30:00+08:00',
    required: false,
  })
  @IsOptional()
  @IsDateString({ strict: true })
  entryTime?: string;

  @ApiProperty({
    description: '入场多空方向',
    enum: EntryDirection,
    example: EntryDirection.LONG,
    required: false,
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
    required: false,
  })
  @IsOptional()
  @IsString()
  entryReason?: string;

  @ApiProperty({
    description: '离场理由',
    example: '价格达到目标位，成交量有很大的放大',
    required: false,
  })
  @IsOptional()
  @IsString()
  exitReason?: string;

  @ApiProperty({
    description: '提前离场原因',
    example: '风险事件触发，提前止损离场',
    required: false,
  })
  @IsOptional()
  @IsString()
  earlyExitReason?: string;

  @ApiProperty({
    description: '交易过程中心态记录',
    example:
      '入场后价格快速下跌，感到紧张但坚持止损点\n价格回升后感到放松，按计划持有',
    required: false,
  })
  @IsOptional()
  @IsString()
  mentalityNotes?: string;

  @ApiProperty({
    description: '已入场分析图，最多10张',
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
  @ApiProperty({ description: '离场价格', example: 148.7, required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  exitPrice?: number;

  @ApiProperty({
    description: '离场时间',
    example: '2025-05-23T14:30:00+08:00',
    required: false,
  })
  @IsOptional()
  @IsDateString({ strict: true })
  exitTime?: string;

  @ApiProperty({
    description: '交易结果',
    enum: TradeResult,
    example: TradeResult.PROFIT,
    required: false,
  })
  @IsOptional()
  @IsEnum(TradeResult)
  tradeResult?: TradeResult;

  @ApiProperty({
    description: '是否符合入场计划',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  followedPlan?: boolean;

  @ApiProperty({
    description: '所遵循的交易计划ID',
    example: 'planA',
    required: false,
  })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.followedPlan === true)
  followedPlanId?: string;

  @ApiProperty({
    description: '实际行情路径图片',
    type: [ImageResource],
    maxItems: 5,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageResource)
  @ArrayMaxSize(5)
  actualPathImages?: ImageResource[];

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
    required: false,
  })
  @IsOptional()
  @IsString()
  actualPathAnalysis?: string;

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
    required: false,
  })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiProperty({
    description: '需要总结的经验',
    example:
      '1. 在价值区内入场多单风险较小\n2. 应该更关注成交量变化\n3. 止盈可以分批设置',
    required: false,
  })
  @IsOptional()
  @IsString()
  lessonsLearned?: string;

  @ApiProperty({
    description: '交易完成后总结重要性评分（1-5）',
    example: 4,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(5)
  lessonsLearnedImportance?: number;

  @ApiProperty({
    description: '分析图，最多5张',
    type: [ImageResource],
    maxItems: 5,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageResource)
  @ArrayMaxSize(5)
  analysisImages?: ImageResource[];

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

  @ApiProperty({
    description: '是否严格遵守交易系统',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  followedSystemStrictly?: boolean;
}
