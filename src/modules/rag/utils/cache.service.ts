import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../common/config.service';

/**
 * 简单的内存缓存服务
 * 用于缓存搜索结果和嵌入向量
 */

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly cache = new Map<string, CacheItem<any>>();
  private readonly defaultTTL: number;
  private readonly maxSize: number;

  constructor(private readonly configService: ConfigService) {
    this.defaultTTL = parseInt(
      this.configService.get('RAG_CACHE_TTL') || '300000',
    ); // 5分钟
    this.maxSize = parseInt(
      this.configService.get('RAG_CACHE_MAX_SIZE') || '1000',
    ); // 最大1000项

    // 定期清理过期缓存
    setInterval(() => this.cleanup(), 60000); // 每分钟清理一次
  }

  /**
   * 设置缓存
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const actualTTL = ttl || this.defaultTTL;

    // 如果缓存已满，删除最旧的项
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.getOldestKey();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: actualTTL,
    });

    this.logger.debug(`Cache set: ${key}`);
  }

  /**
   * 获取缓存
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);

    if (!item) {
      return null;
    }

    // 检查是否过期
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      this.logger.debug(`Cache expired: ${key}`);
      return null;
    }

    this.logger.debug(`Cache hit: ${key}`);
    return item.data;
  }

  /**
   * 删除缓存
   */
  delete(key: string): boolean {
    const result = this.cache.delete(key);
    if (result) {
      this.logger.debug(`Cache deleted: ${key}`);
    }
    return result;
  }

  /**
   * 检查缓存是否存在
   */
  has(key: string): boolean {
    const item = this.cache.get(key);

    if (!item) {
      return false;
    }

    // 检查是否过期
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
    this.logger.log('Cache cleared');
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): {
    size: number;
    maxSize: number;
    defaultTTL: number;
    hitRate?: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      defaultTTL: this.defaultTTL,
    };
  }

  /**
   * 生成缓存键
   */
  static generateKey(prefix: string, ...params: any[]): string {
    const keyParts = [
      prefix,
      ...params.map((p) =>
        typeof p === 'object' ? JSON.stringify(p) : String(p),
      ),
    ];
    return keyParts.join(':');
  }

  /**
   * 为搜索查询生成缓存键
   */
  static generateSearchKey(
    userId: string,
    query: string,
    options: any,
  ): string {
    const normalizedQuery = query.toLowerCase().trim();
    const optionsHash = this.hashObject(options);
    return this.generateKey('search', userId, normalizedQuery, optionsHash);
  }

  /**
   * 为嵌入向量生成缓存键
   */
  static generateEmbeddingKey(text: string, model: string): string {
    const textHash = this.hashString(text);
    return this.generateKey('embedding', model, textHash);
  }

  // 私有方法

  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cache cleanup: removed ${cleanedCount} expired items`);
    }
  }

  private getOldestKey(): string | null {
    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [key, item] of this.cache.entries()) {
      if (item.timestamp < oldestTimestamp) {
        oldestTimestamp = item.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  private static hashString(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 转换为32位整数
    }

    return Math.abs(hash).toString(36);
  }

  private static hashObject(obj: any): string {
    return this.hashString(JSON.stringify(obj));
  }
}
