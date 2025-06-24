/**
 * RAG评估系统配置文件
 *
 * 此文件包含所有可调整的评估参数，方便维护和调优
 * 修改此文件后需要重新编译和部署
 */

export interface RAGEvaluationConfig {
  // 评估阈值
  threshold: number;

  // 文本长度要求
  textRequirements: {
    detailedLessonsLearned: number; // 详细经验总结最小长度
    basicMentalityNotes: number; // 心态记录最小长度
    detailedPathAnalysis: number; // 详细路径分析最小长度
    detailedMarketAnalysis: number; // 详细市场分析最小长度
    basicMarketAnalysis: number; // 基础市场分析最小长度
    basicPathAnalysis: number; // 基础路径分析最小长度
  };

  // 图片数量要求
  imageRequirements: {
    richImages: number; // 丰富图片资源最小数量
    basicImages: number; // 基础图片资源最小数量
  };

  // 各维度权重配置
  weights: {
    tradeStatus: number; // 交易状态权重
    learningValue: number; // 学习价值权重
    tradeImportance: number; // 交易重要性权重
    analysisQuality: number; // 分析质量权重
    resultDiversity: number; // 结果多样性权重
  };

  // 各状态评分
  statusScores: {
    exited: number; // 已离场
    analyzed: number; // 已分析
    analyzedWithDepth: number; // 已分析且有深度内容
    entered: number; // 已入场
  };

  // 学习价值评分
  learningScores: {
    detailedLessons: number; // 详细经验总结
    basicLessons: number; // 基础经验总结
    mentalityNotes: number; // 心态记录
    pathAnalysis: number; // 路径分析
  };

  // 重要性评分
  importanceScores: {
    gradeHigh: number; // 高重要性
    gradeMedium: number; // 中等重要性
    gradeLow: number; // 低重要性
    realTrade: number; // 真实交易
    simulationTrade: number; // 模拟交易
  };

  // 分析质量评分
  qualityScores: {
    detailedMarketAnalysis: number; // 详细市场分析
    basicMarketAnalysis: number; // 基础市场分析
    expectedPathAnalysis: number; // 预期路径分析
    multiplePlans: number; // 多套计划
    singlePlan: number; // 单套计划
    richImages: number; // 丰富图片
    basicImages: number; // 基础图片
  };

  // 结果多样性评分
  diversityScores: {
    loss: number; // 亏损交易
    profit: number; // 盈利交易
    breakeven: number; // 保本交易
  };
}

/**
 * 默认配置 - 当前生产环境使用的配置
 */
export const DEFAULT_RAG_CONFIG: RAGEvaluationConfig = {
  // 评估阈值 (45分 = 50%通过率)
  threshold: 45,

  // 文本长度要求
  textRequirements: {
    detailedLessonsLearned: 20, // 详细经验总结
    basicMentalityNotes: 10, // 心态记录
    detailedPathAnalysis: 20, // 详细路径分析
    detailedMarketAnalysis: 50, // 详细市场分析
    basicMarketAnalysis: 20, // 基础市场分析
    basicPathAnalysis: 20, // 基础路径分析
  },

  // 图片数量要求
  imageRequirements: {
    richImages: 5, // 丰富图片资源
    basicImages: 2, // 基础图片资源
  },

  // 各维度权重 (总计90分)
  weights: {
    tradeStatus: 20, // 交易状态
    learningValue: 25, // 学习价值
    tradeImportance: 15, // 交易重要性
    analysisQuality: 20, // 分析质量
    resultDiversity: 10, // 结果多样性
  },

  // 交易状态评分
  statusScores: {
    exited: 20, // 已离场 (完整流程)
    analyzed: 15, // 已分析 (纯分析)
    analyzedWithDepth: 5, // 已分析且有深度内容 (额外加分)
    entered: 8, // 已入场 (进行中)
  },

  // 学习价值评分
  learningScores: {
    detailedLessons: 15, // 详细经验总结
    basicLessons: 8, // 基础经验总结
    mentalityNotes: 5, // 心态记录
    pathAnalysis: 5, // 路径分析
  },

  // 重要性评分
  importanceScores: {
    gradeHigh: 10, // 高重要性
    gradeMedium: 6, // 中等重要性
    gradeLow: 3, // 低重要性
    realTrade: 5, // 真实交易
    simulationTrade: 2, // 模拟交易
  },

  // 分析质量评分
  qualityScores: {
    detailedMarketAnalysis: 8, // 详细市场分析
    basicMarketAnalysis: 4, // 基础市场分析
    expectedPathAnalysis: 4, // 预期路径分析
    multiplePlans: 4, // 多套计划
    singlePlan: 2, // 单套计划
    richImages: 4, // 丰富图片
    basicImages: 2, // 基础图片
  },

  // 结果多样性评分
  diversityScores: {
    loss: 10, // 亏损交易 (学习价值最高)
    profit: 6, // 盈利交易
    breakeven: 4, // 保本交易
  },
};

/**
 * 宽松配置 - 适合数据稀缺期或初期建库
 */
export const LOOSE_RAG_CONFIG: RAGEvaluationConfig = {
  ...DEFAULT_RAG_CONFIG,
  threshold: 35, // 降低阈值
  textRequirements: {
    ...DEFAULT_RAG_CONFIG.textRequirements,
    detailedLessonsLearned: 15, // 降低文本要求
    detailedMarketAnalysis: 30,
    basicMarketAnalysis: 15,
  },
  imageRequirements: {
    richImages: 3, // 降低图片要求
    basicImages: 1,
  },
};

/**
 * 严格配置 - 适合质量优先或RAG库容量有限时
 */
export const STRICT_RAG_CONFIG: RAGEvaluationConfig = {
  ...DEFAULT_RAG_CONFIG,
  threshold: 60, // 提高阈值
  textRequirements: {
    ...DEFAULT_RAG_CONFIG.textRequirements,
    detailedLessonsLearned: 30, // 提高文本要求
    detailedMarketAnalysis: 80,
    basicMarketAnalysis: 30,
  },
  imageRequirements: {
    richImages: 7, // 提高图片要求
    basicImages: 3,
  },
};

/**
 * 获取当前使用的配置
 * 可以通过环境变量或其他方式切换配置
 */
export function getCurrentRAGConfig(): RAGEvaluationConfig {
  const configMode = process.env.RAG_EVALUATION_MODE || 'default';

  switch (configMode.toLowerCase()) {
    case 'loose':
      return LOOSE_RAG_CONFIG;
    case 'strict':
      return STRICT_RAG_CONFIG;
    case 'default':
    default:
      return DEFAULT_RAG_CONFIG;
  }
}

/**
 * 配置验证函数
 */
export function validateRAGConfig(config: RAGEvaluationConfig): boolean {
  // 检查阈值合理性
  if (config.threshold < 0 || config.threshold > 90) {
    console.warn('RAG评估阈值应该在0-90之间');
    return false;
  }

  // 检查权重总和
  const totalWeight = Object.values(config.weights).reduce(
    (sum, weight) => sum + weight,
    0,
  );
  if (totalWeight !== 90) {
    console.warn(`RAG评估权重总和应该为90，当前为${totalWeight}`);
    return false;
  }

  return true;
}
