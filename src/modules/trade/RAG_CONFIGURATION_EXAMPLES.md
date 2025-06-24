# RAG评估系统配置示例

## 🎯 配置切换方法

### 1. 环境变量切换
```bash
# 默认配置 (平衡策略)
export RAG_EVALUATION_MODE=default

# 宽松配置 (数据稀缺期)
export RAG_EVALUATION_MODE=loose

# 严格配置 (质量优先)
export RAG_EVALUATION_MODE=strict
```

### 2. 代码中直接修改
```typescript
// 在 rag-evaluation.config.ts 中修改 getCurrentRAGConfig() 函数
export function getCurrentRAGConfig(): RAGEvaluationConfig {
  // 强制使用特定配置
  return LOOSE_RAG_CONFIG;  // 或 STRICT_RAG_CONFIG
}
```

## 📊 配置对比

| 配置类型 | 阈值 | 文本要求 | 图片要求 | 适用场景 |
|----------|------|----------|----------|----------|
| **严格** | 60分 | 高 | 多 | 质量优先，RAG库容量有限 |
| **平衡** | 45分 | 中等 | 中等 | 正常运行，平衡质量和数量 |
| **宽松** | 35分 | 低 | 少 | 数据稀缺期，初期建库 |

## 🔧 自定义配置示例

### 示例1: 重视学习价值的配置
```typescript
export const LEARNING_FOCUSED_CONFIG: RAGEvaluationConfig = {
  ...DEFAULT_RAG_CONFIG,
  threshold: 40,  // 稍微降低阈值
  
  // 提高学习价值相关评分
  learningScores: {
    detailedLessons: 20,    // 从15提高到20
    basicLessons: 12,       // 从8提高到12
    mentalityNotes: 8,      // 从5提高到8
    pathAnalysis: 8,        // 从5提高到8
  },
  
  // 降低文本要求，鼓励更多总结
  textRequirements: {
    ...DEFAULT_RAG_CONFIG.textRequirements,
    detailedLessonsLearned: 15,  // 从20降低到15
  },
};
```

### 示例2: 重视分析质量的配置
```typescript
export const ANALYSIS_FOCUSED_CONFIG: RAGEvaluationConfig = {
  ...DEFAULT_RAG_CONFIG,
  threshold: 50,  // 提高阈值
  
  // 提高分析质量相关评分
  qualityScores: {
    detailedMarketAnalysis: 12,   // 从8提高到12
    basicMarketAnalysis: 6,       // 从4提高到6
    expectedPathAnalysis: 6,      // 从4提高到6
    multiplePlans: 6,             // 从4提高到6
    singlePlan: 3,                // 从2提高到3
    richImages: 6,                // 从4提高到6
    basicImages: 3,               // 从2提高到3
  },
  
  // 提高分析文本要求
  textRequirements: {
    ...DEFAULT_RAG_CONFIG.textRequirements,
    detailedMarketAnalysis: 80,   // 从50提高到80
    basicMarketAnalysis: 30,      // 从20提高到30
  },
};
```

### 示例3: 纯分析优化配置
```typescript
export const ANALYSIS_ONLY_CONFIG: RAGEvaluationConfig = {
  ...DEFAULT_RAG_CONFIG,
  threshold: 35,  // 降低阈值，支持纯分析
  
  // 提高纯分析状态评分
  statusScores: {
    exited: 20,           // 保持不变
    analyzed: 18,         // 从15提高到18
    analyzedWithDepth: 7, // 从5提高到7
    entered: 8,           // 保持不变
  },
  
  // 降低对实际交易结果的依赖
  diversityScores: {
    loss: 5,      // 从10降低到5
    profit: 3,    // 从6降低到3
    breakeven: 2, // 从4降低到2
  },
};
```

## 🚀 部署配置

### 开发环境
```typescript
// 使用宽松配置，便于测试
export const DEV_CONFIG = LOOSE_RAG_CONFIG;
```

### 测试环境
```typescript
// 使用平衡配置
export const TEST_CONFIG = DEFAULT_RAG_CONFIG;
```

### 生产环境
```typescript
// 根据实际需求选择
export const PROD_CONFIG = STRICT_RAG_CONFIG; // 或其他配置
```

## 📈 配置调优建议

### 1. 监控通过率
```typescript
// 理想通过率范围
const IDEAL_PASS_RATE = {
  min: 40,  // 最低40%
  max: 60,  // 最高60%
};

// 调优策略
if (passRate < 40) {
  // 降低阈值或放宽要求
  threshold -= 5;
} else if (passRate > 60) {
  // 提高阈值或严格要求
  threshold += 5;
}
```

### 2. 分状态优化
```typescript
// 根据不同状态的通过率调整
const statusPassRates = {
  '已离场': 80,    // 应该很高
  '已分析': 50,    // 中等
  '已入场': 20,    // 较低
};
```

### 3. 季节性调整
```typescript
// 根据交易活跃度调整
const seasonalConfig = {
  highActivity: STRICT_RAG_CONFIG,    // 交易活跃期用严格配置
  normalActivity: DEFAULT_RAG_CONFIG, // 正常期用默认配置
  lowActivity: LOOSE_RAG_CONFIG,      // 淡季用宽松配置
};
```

## 🔍 配置验证

### 验证脚本
```typescript
function validateCustomConfig(config: RAGEvaluationConfig): boolean {
  // 1. 检查阈值合理性
  if (config.threshold < 0 || config.threshold > 90) {
    console.error('阈值应在0-90之间');
    return false;
  }
  
  // 2. 检查权重总和
  const totalWeight = Object.values(config.weights).reduce((sum, w) => sum + w, 0);
  if (totalWeight !== 90) {
    console.error(`权重总和应为90，当前为${totalWeight}`);
    return false;
  }
  
  // 3. 检查评分合理性
  const maxPossibleScore = Object.values(config.weights).reduce((sum, w) => sum + w, 0);
  if (config.threshold > maxPossibleScore) {
    console.error('阈值不能超过最大可能评分');
    return false;
  }
  
  return true;
}
```

## 📝 配置变更记录

### v2.0 (当前版本)
- 移除时间价值评估
- 支持纯分析记录
- 添加配置化支持
- 阈值从60分调整为45分

### 未来计划
- 动态阈值调整
- 机器学习优化
- 个性化配置
- A/B测试支持

---

**注意**: 修改配置后需要重新编译和部署，建议在测试环境验证后再应用到生产环境。
