/**
 * 交易复盘记录表 Trade
 * 字段说明参考 trade-backend/src/trade/dto/README.md 规范
 */
export interface Trade {
  transactionId: string; // 本次复盘唯一标识(UUID), DynamoDB sortKey
  userId: string;        // 所属用户ID, DynamoDB partitionKey

  dateTimeRange: string;         // 训练时段描述，如 “2025-05-18 10:00–11:30”
  marketStructure: string;       // 市场结构判断: Range 或 Trend
  signalType: string;            // 信号类型: Reversal、Continuation、FailedReversal
  vah: number;                   // 价值区上沿价格 (VAH)，如 2500.0
  val: number;                   // 价值区下沿价格 (VAL)，如 2450.0
  poc: number;                   // 成交量中枢价位 (POC)，如 2475.0
  entryDirection: 'Long' | 'Short'; // 多空方向: Long 或 Short
  entryPrice: number;            // 入场价格，如 2478.0
  stopLossPrice: number;         // 止损价格，如 2450.0
  targetPrice: number;           // 止盈目标价格，如 2520.0
  volumeProfileImage: string;    // 成交量分布截图存储键 (S3 Key)
  hypothesisPaths: string[];     // 价格演变假设列表（如 ["A: to VAH", "B: back to POC"]，最多 3 项）
  actualPath: string;            // 最终行情路径标签（如“符合路径 B”）
  profitLoss: number;            // 盈亏百分比 (如 1.2 表示+1.2%)
  rr: string;                    // 风险报酬比 (如 '1:2')
  analysisError: string;         // 判断失误及原因（如“漏看二次测试失败”）
  executionMindsetScore: number; // 执行与心态评分（1~5 分）
  improvement: string;           // 改进措施文本（如“关注 POC 处成交量变化”）

  createdAt: string;    // 记录创建时间 (ISO 8601)
  updatedAt: string;    // 记录最后更新时间 (ISO 8601)
}