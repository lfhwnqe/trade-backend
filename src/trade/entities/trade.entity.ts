export interface Trade {
  transactionId: string; // DynamoDB sortKey，用于唯一标识交易
  userId: string; // DynamoDB partitionKey

  dateTimeRange: string; // 日期/时间段（如 2025-05-18 10:00–11:30）
  marketStructure: string; // 市场结构判断（如 平衡、失衡）
  signalType: string; // 信号类型（如 反转、延续、反转失败）
  vah: string; // VAH (上沿)
  val: string; // VAL (下沿)
  poc: string; // POC（成交量中枢）
  entry: string; // 入场方向 & 价位
  stopLoss: string; // 止损价位
  target: string; // 目标价位
  volumeProfileImage: string; // 成交量分布截图文件名
  hypothesisPaths: string[]; // 假设路径 A/B/C
  actualPath: string; // 实际行情路径
  profitLoss: string; // 盈亏结果
  rr: string; // 风险报酬比 (RR)
  analysisError: string; // 分析误差 & 原因
  executionMindsetScore: number; // 执行 & 心态评分（1~5）
  improvement: string; // 改进措施

  createdAt: string; // ISO 时间字符串
  updatedAt: string; // ISO 时间字符串
}