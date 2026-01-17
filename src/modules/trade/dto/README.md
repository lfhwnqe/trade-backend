# 交易日志系统字段说明

本文档详细介绍了交易日志系统中使用的数据字段，按照交易流程分为四个主要部分：交易状态、入场前分析、入场记录和离场后分析。

## 1. 系统概览

**表名**：TradingJournal

**用途**：记录完整的交易过程，包括交易前的分析、入场记录以及离场后的复盘，便于后续查询、统计与经验总结。

## 2. 主键设计

| 项目 | 名称 | 类型 | 说明 |
|------|------|------|------|
| 主键 | id | UUID | 交易记录的唯一标识 |
| 创建时间 | createdAt | DateTime | 记录创建时间 |
| 更新时间 | updatedAt | DateTime | 记录更新时间 |

## 3. 字段详细说明

### 3.1 交易状态

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| status | enum | 交易状态 | 已分析/待入场/已入场/已离场 |

### 3.2 入场前分析

### 3.1 入场前分析

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| analysisTime | DateTime | 行情分析时间 | "2025-05-23T09:30:00+08:00" |
| volumeProfileImages | ImageResource[] | 成交量分布图，最多5张 | [{key: "images/vol1.jpg", url: "https://..."}, ...] |
| poc | number | 成交量分布图POC价格（Point of Control） | 147.8 |
| val | number | 价值区下沿价格（Value Area Low） | 145.2 |
| vah | number | 价值区上沿价格（Value Area High） | 150.5 |
| keyPriceLevels | string | 其他关键价格点 | "日内高点: 152.3\n日内低点: 144.8\n前日收盘: 146.2" |
| marketStructure | enum | 市场结构判断 | 平衡/失衡/未见过 |
| marketStructureAnalysis | string | 市场结构详细分析 | "市场处于平衡状态，价格在价值区内震荡..." |
| preEntrySummary | string | 入场前分析总结 | "当前市场结构偏平衡，关注价值区上沿突破机会" |
| preEntrySummaryImportance | number | 入场前总结重要性评分（1-5） | 3 |
| expectedPathImages | ImageResource[] | 预计路径图片，最多5张 | [{key: "images/path1.jpg", url: "https://..."}, ...] |
| expectedPathAnalysis | string | 预计路径分析 | "预计价格将在价值区内震荡，随后向上突破..." |
| entryPlanA | EntryPlan | 入场计划A（非必填） | {entryReason: "...", entrySignal: "...", exitSignal: "..."} |
| entryPlanB | EntryPlan | 入场计划B（非必填） | 同上 |
| entryPlanC | EntryPlan | 入场计划C（非必填） | 同上 |
| checklist | ChecklistState | 入场前检查清单（待入场状态可填写） | {phaseAnalysis: true, rangeAnalysis: false} |

#### 3.1.1 入场计划（EntryPlan）结构

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| entryReason | string | 入场理由 | "价格回调至支撑位，成交量减少，预计反弹" |
| entrySignal | string | 入场信号 | "价格突破前高，成交量放大" |
| exitSignal | string | 退出信号 | "价格跌破支撑位，成交量放大" |

#### 3.1.2 入场前检查（ChecklistState）结构

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| phaseAnalysis | boolean | 阶段分析：判断当前行情所处阶段（震荡/趋势） | true |
| rangeAnalysis | boolean | 震荡阶段：关键阻力点、VWAP位置、威科夫区间边缘与小溪测试行为 | true |
| trendAnalysis | boolean | 趋势阶段：最近高成交量节点（可能回调测试点/入场价格） | true |
| riskRewardCheck | boolean | 盈亏比计算是否完成 | true |

### 3.2 入场记录

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| entryPrice | number | 入场价格 | 146.5 |
| entryTime | DateTime | 入场时间 | "2025-05-23T09:30:00+08:00" |
| entryDirection | enum | 入场方向 | 多/空 |
| stopLoss | number | 止损点 | 145.0 |
| takeProfit | number | 止盈点 | 149.5 |
| mentalityNotes | string | 交易过程中心态记录 | "入场后价格快速下跌，感到紧张但坚持止损点..." |

### 3.3 离场后分析

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| exitPrice | number | 离场价格 | 148.7 |
| exitTime | DateTime | 离场时间 | "2025-05-23T14:30:00+08:00" |
| tradeResult | enum | 交易结果 | PROFIT/LOSS/BREAKEVEN（字段存储英文值） |
| followedPlan | boolean | 是否符合入场计划 | true |
| actualPathImages | ImageResource[] | 实际行情路径图片，最多5张 | [{key: "images/actual1.jpg", url: "https://..."}, ...] |
| actualPathAnalysis | string | 实际行情路径分析 | "价格如预期在价值区内震荡后向上突破..." |
| remarks | string | 备注 | "这次交易整体执行较好，但离场时机可以更优化" |
| lessonsLearned | string | 需要总结的经验 | "1. 在价值区内入场多单风险较小\n2. 应该更关注成交量变化..." |
| lessonsLearnedImportance | number | 交易完成后总结重要性评分（1-5） | 4 |
| analysisImages | ImageResource[] | 分析图，最多5张 | [{key: "images/analysis1.jpg", url: "https://..."}, ...] |

### 3.4 计算字段

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| profitLossPercentage | number | 盈亏百分比 | 2.5 |
| riskRewardRatio | string | 风险回报比 | "1:3" |

## 4. 图片资源（ImageResource）结构

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| key | string | 图片资源ID/键值 | "images/2023-05-23/user123/image1.jpg" |
| url | string | 图片完整URL | "https://example.com/images/image1.jpg" |

## 5. 枚举类型

### 5.1 交易状态（TradeStatus）

- 已分析（ANALYZED）
- 待入场（WAITING）
- 已入场（ENTERED）
- 已离场（EXITED）

### 5.2 市场结构（MarketStructure）

- 震荡（BALANCED）
- 趋势（IMBALANCED）
- 暂无法判断（UNSEEN）

### 5.3 入场方向（EntryDirection）

- 多（LONG）
- 空（SHORT）

### 5.4 交易结果（TradeResult）

- PROFIT（盈利）
- LOSS（亏损）
- BREAKEVEN（保本）

### 5.5 验证规则说明

- 所有图片数组字段（volumeProfileImages, expectedPathImages, actualPathImages, analysisImages）最多5张
- 入场相关字段（entryPrice, entryTime, entryDirection, stopLoss, takeProfit, entryReason, exitReason, mentalityNotes）仅在交易状态为已入场或已离场时必填
- 离场相关字段（exitPrice, exitTime, tradeResult, followedPlan）仅在交易状态为已离场时必填
- 所有数字类型字段均需进行类型验证和数值范围验证
- 所有时间字段需符合ISO 8601格式
- 所有枚举类型字段需严格匹配预定义值
- 图片资源对象需包含key和url两个字段，且均为字符串类型

### 5.1 市场结构（MarketStructure）

- 平衡（BALANCED）
- 失衡（IMBALANCED）
- 未见过（UNSEEN）

### 5.2 入场方向（EntryDirection）

- 多（LONG）
- 空（SHORT）

### 5.3 交易结果（TradeResult）

- PROFIT（盈利）
- LOSS（亏损）
- BREAKEVEN（保本）

## 6. 建议的查询索引

为了支持高效查询，建议设置以下索引：

1. **按交易结果查询**：tradeResult + entryTime
2. **按市场结构查询**：marketStructure + entryTime
3. **按入场方向查询**：entryDirection + entryTime
4. **按时间范围查询**：entryTime（范围查询）
