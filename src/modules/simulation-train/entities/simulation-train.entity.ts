import {
  MarketStructure,
  EntryDirection,
  TradeResult,
  TradeStatus,
  ImageResource,
  EntryPlan,
} from '../dto/create-simulation-train.dto';

/**
 * 模拟交易训练表 SimulationTrain
 * 字段说明参考 trade-backend/src/trade/dto/README.md 规范
 */
export interface SimulationTrain {
  analysisTime?: string; // 行情分析时间
  simulationTrainId: string; // 本次模拟训练唯一标识(UUID), DynamoDB sortKey
  userId: string; // 所属用户ID, DynamoDB partitionKey

  // ===== 交易状态 =====
  status: TradeStatus; // 交易状态: 已分析/已入场/已离场

  // ===== 入场前分析 =====
  volumeProfileImages: ImageResource[]; // 成交量分布图，最多5张图
  poc: number; // 成交量分布图POC价格
  val: number; // 价值区下沿价格
  vah: number; // 价值区上沿价格
  keyPriceLevels?: string; // 其他关键价格点
  marketStructure: MarketStructure; // 市场结构判断: 平衡/失衡/未见过
  marketStructureAnalysis: string; // 市场结构详细分析
  expectedPathImages?: ImageResource[]; // 预计路径图片
  expectedPathAnalysis?: string; // 预计路径分析
  entryPlanA: EntryPlan; // 入场计划A
  entryPlanB?: EntryPlan; // 入场计划B
  entryPlanC?: EntryPlan; // 入场计划C

  // ===== 入场记录 =====
  entryPrice?: number; // 入场价格
  entryTime?: string; // 入场时间
  entryDirection?: EntryDirection; // 多空方向: 多/空
  stopLoss?: number; // 止损点
  takeProfit?: number; // 止盈点
  entryReason?: string; // 入场理由
  exitReason?: string; // 离场理由
  mentalityNotes?: string; // 交易过程中心态记录

  // ===== 离场后分析 =====
  exitPrice?: number; // 离场价格
  exitTime?: string; // 离场时间
  tradeResult?: TradeResult; // 交易结果: 盈利/亏损/保本
  followedPlan?: boolean; // 是否符合入场计划
  followedPlanId?: string; // 所遵循的交易计划ID
  actualPathImages?: ImageResource[]; // 实际行情路径图片
  actualPathAnalysis?: string; // 实际行情路径分析
  remarks?: string; // 备注
  lessonsLearned?: string; // 需要总结的经验
  analysisImages?: ImageResource[]; // 分析图，最多5张

  // 基础计算字段
  profitLossPercentage?: number; // 盈亏百分比
  riskRewardRatio?: string; // 风险回报比

  createdAt: string; // 记录创建时间 (ISO 8601)
  updatedAt: string; // 记录最后更新时间 (ISO 8601)
}