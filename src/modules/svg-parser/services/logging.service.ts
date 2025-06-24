import { Injectable, Logger } from '@nestjs/common';
import {
  SVGParseRequest,
  SVGParseResponse,
  PerformanceMetrics,
} from '../types';

export interface LogContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  ip?: string;
}

export interface ParseLogEntry {
  timestamp: Date;
  requestId: string;
  inputType: string;
  inputSize: number;
  success: boolean;
  parseTime: number;
  nodeCount: number;
  edgeCount: number;
  errorCount: number;
  memoryUsage: number;
  context: LogContext;
}

@Injectable()
export class LoggingService {
  private readonly logger = new Logger(LoggingService.name);
  private readonly parseHistory: ParseLogEntry[] = [];
  private readonly maxHistorySize = 1000;

  /**
   * 记录解析开始
   */
  logParseStart(request: SVGParseRequest, context: LogContext = {}): string {
    const requestId = this.generateRequestId();

    this.logger.log(`[${requestId}] 开始SVG解析`, {
      requestId,
      inputType: request.inputType,
      inputSize: this.getInputSize(request.input),
      options: request.options,
      context,
    });

    return requestId;
  }

  /**
   * 记录解析完成
   */
  logParseComplete(
    requestId: string,
    request: SVGParseRequest,
    response: SVGParseResponse,
    context: LogContext = {},
  ): void {
    const logEntry: ParseLogEntry = {
      timestamp: new Date(),
      requestId,
      inputType: request.inputType,
      inputSize: this.getInputSize(request.input),
      success: response.success,
      parseTime: response.metrics.parseTime,
      nodeCount: response.metrics.nodeCount,
      edgeCount: response.metrics.edgeCount,
      errorCount: response.errors.length,
      memoryUsage: response.metrics.memoryUsage,
      context,
    };

    // 添加到历史记录
    this.addToHistory(logEntry);

    if (response.success) {
      this.logger.log(`[${requestId}] SVG解析成功`, {
        parseTime: response.metrics.parseTime,
        nodeCount: response.metrics.nodeCount,
        edgeCount: response.metrics.edgeCount,
        memoryUsage: this.formatBytes(response.metrics.memoryUsage),
      });
    } else {
      this.logger.error(`[${requestId}] SVG解析失败`, {
        errorCount: response.errors.length,
        errors: response.errors.map((e) => ({
          code: e.code,
          message: e.message,
        })),
        parseTime: response.metrics.parseTime,
      });
    }
  }

  /**
   * 记录性能警告
   */
  logPerformanceWarning(requestId: string, metrics: PerformanceMetrics): void {
    const warnings: string[] = [];

    if (metrics.parseTime > 30000) {
      warnings.push(`解析时间过长: ${metrics.parseTime}ms`);
    }

    if (metrics.memoryUsage > 512 * 1024 * 1024) {
      warnings.push(`内存使用过高: ${this.formatBytes(metrics.memoryUsage)}`);
    }

    if (metrics.nodeCount > 1000) {
      warnings.push(`节点数量过多: ${metrics.nodeCount}`);
    }

    if (warnings.length > 0) {
      this.logger.warn(`[${requestId}] 性能警告`, {
        warnings,
        metrics: {
          parseTime: metrics.parseTime,
          memoryUsage: this.formatBytes(metrics.memoryUsage),
          nodeCount: metrics.nodeCount,
          edgeCount: metrics.edgeCount,
        },
      });
    }
  }

  /**
   * 记录详细的解析步骤
   */
  logParseStep(requestId: string, step: string, details?: any): void {
    this.logger.debug(`[${requestId}] ${step}`, details);
  }

  /**
   * 记录错误详情
   */
  logError(requestId: string, error: Error, context?: any): void {
    this.logger.error(`[${requestId}] 解析错误: ${error.message}`, {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context,
    });
  }

  /**
   * 获取解析统计信息
   */
  getParseStatistics(timeRange?: { start: Date; end: Date }): {
    totalParses: number;
    successRate: number;
    averageParseTime: number;
    averageNodeCount: number;
    averageMemoryUsage: number;
    errorDistribution: Record<string, number>;
  } {
    let entries = this.parseHistory;

    if (timeRange) {
      entries = entries.filter(
        (entry) =>
          entry.timestamp >= timeRange.start &&
          entry.timestamp <= timeRange.end,
      );
    }

    if (entries.length === 0) {
      return {
        totalParses: 0,
        successRate: 0,
        averageParseTime: 0,
        averageNodeCount: 0,
        averageMemoryUsage: 0,
        errorDistribution: {},
      };
    }

    const successfulParses = entries.filter((entry) => entry.success);
    const totalParseTime = entries.reduce(
      (sum, entry) => sum + entry.parseTime,
      0,
    );
    const totalNodeCount = entries.reduce(
      (sum, entry) => sum + entry.nodeCount,
      0,
    );
    const totalMemoryUsage = entries.reduce(
      (sum, entry) => sum + entry.memoryUsage,
      0,
    );

    return {
      totalParses: entries.length,
      successRate: (successfulParses.length / entries.length) * 100,
      averageParseTime: totalParseTime / entries.length,
      averageNodeCount: totalNodeCount / entries.length,
      averageMemoryUsage: totalMemoryUsage / entries.length,
      errorDistribution: this.calculateErrorDistribution(entries),
    };
  }

  /**
   * 获取最近的解析历史
   */
  getRecentParseHistory(limit: number = 50): ParseLogEntry[] {
    return this.parseHistory
      .slice(-limit)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * 清理旧的日志记录
   */
  cleanupOldLogs(olderThan: Date): void {
    const initialCount = this.parseHistory.length;

    for (let i = this.parseHistory.length - 1; i >= 0; i--) {
      if (this.parseHistory[i].timestamp < olderThan) {
        this.parseHistory.splice(i, 1);
      }
    }

    const removedCount = initialCount - this.parseHistory.length;
    if (removedCount > 0) {
      this.logger.log(`清理了 ${removedCount} 条旧日志记录`);
    }
  }

  /**
   * 私有辅助方法
   */
  private generateRequestId(): string {
    return `svg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getInputSize(input: any): number {
    if (typeof input === 'string') {
      return Buffer.byteLength(input, 'utf8');
    }
    if (Buffer.isBuffer(input)) {
      return input.length;
    }
    return 0;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private addToHistory(entry: ParseLogEntry): void {
    this.parseHistory.push(entry);

    // 保持历史记录大小限制
    if (this.parseHistory.length > this.maxHistorySize) {
      this.parseHistory.shift();
    }
  }

  private calculateErrorDistribution(
    entries: ParseLogEntry[],
  ): Record<string, number> {
    const distribution: Record<string, number> = {};

    entries.forEach((entry) => {
      if (!entry.success) {
        const key = entry.errorCount > 0 ? 'parse_error' : 'unknown_error';
        distribution[key] = (distribution[key] || 0) + 1;
      }
    });

    return distribution;
  }
}
