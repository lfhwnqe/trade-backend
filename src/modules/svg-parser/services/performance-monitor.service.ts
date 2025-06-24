import { Injectable, Logger } from '@nestjs/common';
import { PerformanceMetrics, GraphData } from '../types';

@Injectable()
export class PerformanceMonitorService {
  private readonly logger = new Logger(PerformanceMonitorService.name);
  private startMemory: number = 0;
  private startTime: number = 0;

  /**
   * 开始性能监控
   */
  startMonitoring(): void {
    this.startTime = Date.now();
    this.startMemory = process.memoryUsage().heapUsed;

    this.logger.debug('性能监控开始');
  }

  /**
   * 获取性能指标
   */
  getMetrics(
    requestStartTime: number,
    graphData?: GraphData,
  ): PerformanceMetrics {
    const endTime = Date.now();
    const endMemory = process.memoryUsage().heapUsed;

    const metrics: PerformanceMetrics = {
      parseTime: endTime - requestStartTime,
      memoryUsage: endMemory - this.startMemory,
      nodeCount: graphData?.nodes.length || 0,
      edgeCount: graphData?.edges.length || 0,
      elementCount:
        (graphData?.nodes.length || 0) + (graphData?.edges.length || 0),
    };

    this.logMetrics(metrics);
    this.checkPerformanceThresholds(metrics);

    return metrics;
  }

  /**
   * 记录性能指标
   */
  private logMetrics(metrics: PerformanceMetrics): void {
    this.logger.log(
      `性能指标 - 解析时间: ${metrics.parseTime}ms, 内存使用: ${this.formatBytes(metrics.memoryUsage)}, 节点: ${metrics.nodeCount}, 边: ${metrics.edgeCount}`,
    );
  }

  /**
   * 检查性能阈值
   */
  private checkPerformanceThresholds(metrics: PerformanceMetrics): void {
    const warnings: string[] = [];

    // 检查解析时间阈值 (30秒)
    if (metrics.parseTime > 30000) {
      warnings.push(`解析时间超过阈值: ${metrics.parseTime}ms > 30000ms`);
    }

    // 检查内存使用阈值 (512MB)
    const memoryLimitBytes = 512 * 1024 * 1024;
    if (metrics.memoryUsage > memoryLimitBytes) {
      warnings.push(
        `内存使用超过阈值: ${this.formatBytes(metrics.memoryUsage)} > 512MB`,
      );
    }

    // 检查节点数量阈值 (1000个)
    if (metrics.nodeCount > 1000) {
      warnings.push(`节点数量超过阈值: ${metrics.nodeCount} > 1000`);
    }

    // 记录警告
    warnings.forEach((warning) => {
      this.logger.warn(`性能警告: ${warning}`);
    });

    // 记录性能等级
    this.logPerformanceLevel(metrics);
  }

  /**
   * 检查是否应该中断解析
   */
  checkShouldAbort(
    startTime: number,
    options: { timeout: number; maxNodes?: number },
  ): {
    shouldAbort: boolean;
    reason?: string;
  } {
    const currentTime = Date.now();
    const elapsed = currentTime - startTime;

    // 检查超时 - 只有在真正超时时才中断
    if (elapsed > options.timeout && options.timeout > 0) {
      return {
        shouldAbort: true,
        reason: `解析超时，已用时${elapsed}ms，超过限制${options.timeout}ms`,
      };
    }

    // 检查内存使用
    const memoryUsage = process.memoryUsage().heapUsed;
    const memoryLimitBytes = 512 * 1024 * 1024;
    if (memoryUsage > memoryLimitBytes) {
      return {
        shouldAbort: true,
        reason: `内存使用过高: ${this.formatBytes(memoryUsage)}`,
      };
    }

    return { shouldAbort: false };
  }

  /**
   * 记录性能等级
   */
  private logPerformanceLevel(metrics: PerformanceMetrics): void {
    let level = 'excellent';

    if (metrics.parseTime > 10000 || metrics.memoryUsage > 100 * 1024 * 1024) {
      level = 'good';
    }

    if (metrics.parseTime > 20000 || metrics.memoryUsage > 256 * 1024 * 1024) {
      level = 'fair';
    }

    if (metrics.parseTime > 30000 || metrics.memoryUsage > 512 * 1024 * 1024) {
      level = 'poor';
    }

    this.logger.log(`性能等级: ${level}`);
  }

  /**
   * 格式化字节数
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 获取系统资源使用情况
   */
  getSystemMetrics(): {
    memory: NodeJS.MemoryUsage;
    uptime: number;
    cpuUsage: NodeJS.CpuUsage;
  } {
    return {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      cpuUsage: process.cpuUsage(),
    };
  }

  /**
   * 检查系统资源是否充足
   */
  checkSystemResources(): {
    sufficient: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];
    const memory = process.memoryUsage();

    // 检查堆内存使用率
    const heapUsagePercent = (memory.heapUsed / memory.heapTotal) * 100;
    if (heapUsagePercent > 80) {
      warnings.push(`堆内存使用率过高: ${heapUsagePercent.toFixed(2)}%`);
    }

    // 检查外部内存
    if (memory.external > 100 * 1024 * 1024) {
      warnings.push(`外部内存使用过高: ${this.formatBytes(memory.external)}`);
    }

    return {
      sufficient: warnings.length === 0,
      warnings,
    };
  }

  /**
   * 创建性能报告
   */
  createPerformanceReport(metrics: PerformanceMetrics): {
    summary: string;
    details: Record<string, any>;
    recommendations: string[];
  } {
    const recommendations: string[] = [];

    // 基于指标生成建议
    if (metrics.parseTime > 15000) {
      recommendations.push('考虑优化SVG结构或减少元素数量以提高解析速度');
    }

    if (metrics.memoryUsage > 256 * 1024 * 1024) {
      recommendations.push('内存使用较高，建议分批处理大型SVG文件');
    }

    if (metrics.nodeCount > 500) {
      recommendations.push('节点数量较多，可能影响后续图算法性能');
    }

    const summary = this.generatePerformanceSummary(metrics);

    return {
      summary,
      details: {
        parseTime: `${metrics.parseTime}ms`,
        memoryUsage: this.formatBytes(metrics.memoryUsage),
        nodeCount: metrics.nodeCount,
        edgeCount: metrics.edgeCount,
        elementCount: metrics.elementCount,
        efficiency: this.calculateEfficiency(metrics),
      },
      recommendations,
    };
  }

  /**
   * 生成性能摘要
   */
  private generatePerformanceSummary(metrics: PerformanceMetrics): string {
    const timeCategory = this.categorizeTime(metrics.parseTime);
    const memoryCategory = this.categorizeMemory(metrics.memoryUsage);
    const sizeCategory = this.categorizeSize(metrics.nodeCount);

    return `解析${sizeCategory}规模图形，用时${timeCategory}，内存使用${memoryCategory}`;
  }

  /**
   * 分类解析时间
   */
  private categorizeTime(time: number): string {
    if (time < 1000) return '极快';
    if (time < 5000) return '快速';
    if (time < 15000) return '正常';
    if (time < 30000) return '较慢';
    return '缓慢';
  }

  /**
   * 分类内存使用
   */
  private categorizeMemory(memory: number): string {
    const mb = memory / (1024 * 1024);
    if (mb < 10) return '很低';
    if (mb < 50) return '低';
    if (mb < 100) return '正常';
    if (mb < 256) return '较高';
    return '很高';
  }

  /**
   * 分类图形规模
   */
  private categorizeSize(nodeCount: number): string {
    if (nodeCount < 10) return '小';
    if (nodeCount < 50) return '中等';
    if (nodeCount < 200) return '大';
    if (nodeCount < 500) return '很大';
    return '超大';
  }

  /**
   * 计算效率指标
   */
  private calculateEfficiency(metrics: PerformanceMetrics): string {
    if (metrics.elementCount === 0) return '0%';

    // 简单的效率计算：元素数量/时间
    const elementsPerSecond = (metrics.elementCount / metrics.parseTime) * 1000;

    if (elementsPerSecond > 100) return '高效';
    if (elementsPerSecond > 50) return '良好';
    if (elementsPerSecond > 20) return '一般';
    return '较低';
  }
}
