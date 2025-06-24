# RAG评估系统 - 快速参考卡

## 🎯 一分钟了解

**目标**: 自动筛选有价值的交易记录添加到RAG系统  
**方法**: 6维度评分，总分90分，阈值45分  
**支持**: 完整交易、纯分析、进行中交易  

## ⚡ 快速配置

### 调整通过率
```typescript
// 位置: trade.service.ts -> evaluateTradeValueForRAG()
const threshold = 45; // 修改此值

// 建议值:
// 35分 = 宽松 (更多记录)
// 45分 = 平衡 (当前)  
// 60分 = 严格 (高质量)
```

### 调整文本要求
```typescript
// 详细经验总结
lessonsLearned.trim().length > 20  // 可改为 15 或 30

// 市场分析
marketStructureAnalysis.trim().length > 50  // 详细分析
marketStructureAnalysis.trim().length > 20  // 基础分析
```

### 调整图片要求
```typescript
if (imageCount >= 5) score += 4;  // 丰富: 改为 3 或 7
if (imageCount >= 2) score += 2;  // 基础: 改为 1 或 3
```

## 📊 评分速查表

| 维度 | 满分 | 关键因素 |
|------|------|----------|
| 交易状态 | 20分 | 已离场(20) > 已分析(15) > 已入场(8) |
| 学习价值 | 25分 | 经验总结(15) + 心态(5) + 路径分析(5) |
| 交易重要性 | 15分 | 分级(高10/中6/低3) + 类型(真实5/模拟2) |
| 分析质量 | 20分 | 市场分析(8) + 预期路径(4) + 计划(4) + 图片(4) |
| 结果多样性 | 10分 | 亏损(10) > 盈利(6) > 保本(4) |
| **总分** | **90分** | **阈值: 45分** |

## 🔧 常见维护任务

### 1. 记录太多了
```typescript
const threshold = 60; // 提高到60分
```

### 2. 记录太少了  
```typescript
const threshold = 35; // 降低到35分
// 或者降低文本长度要求
lessonsLearned.trim().length > 10  // 从20改为10
```

### 3. 新增交易状态
1. 在 `assessTradeStatus()` 添加评分
2. 在 `isTradeDataComplete()` 添加验证
3. 更新测试用例

### 4. 调试某个交易为什么没通过
```typescript
// 临时添加到 checkAndAddToRAGHistory()
const evaluation = this.evaluateTradeValueForRAG(trade);
console.log('评估结果:', evaluation);
```

## 🐛 问题排查

### Q: 交易没被添加到RAG？
1. 检查必要字段是否为空
2. 查看总分是否 ≥ 45分
3. 确认交易状态正确

### Q: 通过率异常？
- 正常通过率: 40-60%
- 过高: 提高阈值或文本要求
- 过低: 降低阈值或放宽要求

## 🧪 测试命令

```bash
# 运行RAG评估测试
npm test -- trade-rag-evaluation.spec.ts

# 编译检查
npm run build
```

## 📍 关键文件位置

- **主实现**: `trade.service.ts` (行747-1050)
- **测试文件**: `trade-rag-evaluation.spec.ts`
- **详细文档**: `RAG_EVALUATION_IMPROVEMENT.md`

## 🎛️ 核心方法

```typescript
checkAndAddToRAGHistory()     // 主入口
evaluateTradeValueForRAG()    // 核心评估
assessTradeStatus()           // 状态评估 (20分)
assessLearningValue()         // 学习价值 (25分)
assessTradeImportance()       // 重要性 (15分)
assessAnalysisQuality()       // 分析质量 (20分)
assessResultDiversity()       // 结果多样性 (10分)
```

---
**快速帮助**: 遇到问题先查看详细文档 `RAG_EVALUATION_IMPROVEMENT.md`
