1. 表概览
表名（TableName）：TradingJournal

用途：存储每次 ETH 日内模拟交易复盘的完整记录，供查询、统计与回顾使用。

2. 主键方案
项目	名称	类型	说明
分区键 (PK)	EntryID	String	本次复盘唯一标识：UUID。
排序键 (SK)	Timestamp	String	ISO 8601 格式的训练开始时间（如 2025-05-18T10:00:00Z）。

以 EntryID + Timestamp 组成复合主键，确保全表唯一且按时间可排序。

3. 属性定义
字段名	DynamoDB 类型	备注与示例
DatePeriod	S	训练时段描述（例：2025-05-18 10:00–11:30）
MarketStructure	S	市场结构判断：Range 或 Trend
SignalType	S	触发信号类型：Reversal／Continuation／FailedReversal
VAH	N	价值区上沿价格（如 2500.0）
VAL	N	价值区下沿价格（如 2450.0）
POC	N	成交量中枢价位（如 2475.0）
EntryDirection	S	多空方向：Long 或 Short
EntryPrice	N	入场价格（如 2478.0）
StopLossPrice	N	止损价格（如 2450.0）
TargetPrice	N	止盈目标价格（如 2520.0）
VolumeProfileScreenshotKey	S	截图在 S3 的存储键（s3://bucket/path/to/screenshot.png）
Hypotheses	L of S	价格演变假设列表（例：["A: to VAH", "B: back to POC"]）
ActualPath	S	最终行情路径标签（如 符合路径 B）
PnLPercent	N	盈亏百分比（例：1.2 表示 +1.2%）
RiskRewardRatio	S	风险报酬比（例：1:2）
AnalysisErrorAndCause	S	判断失误及原因（例：漏看二次测试失败）
ExecutionMindsetScore	N	执行与心态评分（1–5 分）
ImprovementActions	S	改进措施文本（例：关注 POC 处成交量变化）
CreatedAt	S	记录创建时间（ISO 8601，例如 2025-05-18T11:30:00Z）
UpdatedAt	S	记录最后更新时间，用于乐观锁或审计（同上格式）

4. 建议的全局二级索引（GSI）
为了支持按日期范围与市场结构查询，可增加以下 GSI：

GSI1 – 按日期查询

索引名：GSI_Date

分区键 (PK)：CreatedAt（取日期部分，如 2025-05-18）

排序键 (SK)：Timestamp

用途：获取某天所有复盘记录，按时间排序。

GSI2 – 按市场结构查询

索引名：GSI_Structure

分区键 (PK)：MarketStructure

排序键 (SK)：Timestamp

用途：筛选所有 Range 或 Trend 类型记录，分析结构表现。

