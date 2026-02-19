import { Injectable, Logger } from '@nestjs/common';
import { CreateTradeDto, TradeResult, TradeType } from './dto/create-trade.dto';
import { UpdateTradeDto } from './dto/update-trade.dto';
import { Trade } from './entities/trade.entity';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'node:crypto';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { ConfigService } from '../common/config.service';
import { TradeQueryDto } from './dto/trade-query.dto';
import {
  DynamoDBException,
  AuthorizationException,
  ResourceNotFoundException,
  ValidationException,
} from '../../base/exceptions/custom.exceptions';
import { ERROR_CODES } from '../../base/constants/error-codes';

@Injectable()
export class TradeService {
  private readonly logger = new Logger(TradeService.name);
  private readonly db: DynamoDBDocument;
  private readonly tableName: string;
  private readonly createdAtIndexName = 'userId-createdAt-index';
  private readonly shareIdIndexName = 'shareId-index';


  private readonly tradeImageFields: (keyof Trade)[] = [
    'volumeProfileImages',
    'marketStructureAnalysisImages',
    'trendAnalysisImages',
    'expectedPathImages',
    'expectedPathImagesDetailed',
    'entryAnalysisImages',
    'entryAnalysisImagesDetailed',
    'actualPathImages',
    'actualPathImagesDetailed',
    'analysisImages',
    'analysisImagesDetailed',
  ];


  private normalizeImageArrayForStorage(items: any[] | undefined) {
    if (!Array.isArray(items)) return items;
    return items.map((item) => {
      const image = item?.image;
      if (!image || typeof image !== 'object') return item;
      const key = typeof image.key === 'string' ? image.key : undefined;
      return {
        ...item,
        image: {
          ...(image || {}),
          ...(key ? { key } : {}),
          url: key ? '' : image.url || '',
        },
      };
    });
  }

  private sanitizeTradeImageUrlsForStorage<T extends Partial<Trade>>(trade: T): T {
    const out: any = { ...trade };
    for (const field of this.tradeImageFields) {
      out[field] = this.normalizeImageArrayForStorage((out as any)[field]);
    }
    return out as T;
  }

  private extractLegacyKeyFromUrl(url: string): string | null {
    try {
      const u = new URL(url);
      const parts = u.pathname.replace(/^\/+/, '').split('/').filter(Boolean);
      if (parts.length >= 2 && parts[0] === 'images') {
        return parts.join('/');
      }
      if (parts.length >= 3 && parts[1] === 'images') {
        return parts.slice(1).join('/');
      }
      return null;
    } catch {
      return null;
    }
  }

  async migrateLegacyImageRefs(userId: string, opts?: { limit?: number; dryRun?: boolean }) {
    const limit = Math.min(Math.max(opts?.limit ?? 200, 1), 2000);
    const dryRun = opts?.dryRun !== false;

    const items: Trade[] = [];
    let lastKey: Record<string, any> | undefined;
    do {
      const res = await this.db.query({
        TableName: this.tableName,
        IndexName: this.createdAtIndexName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
        ScanIndexForward: false,
        Limit: 100,
        ExclusiveStartKey: lastKey,
      });
      items.push(...((res.Items || []) as Trade[]));
      lastKey = res.LastEvaluatedKey;
    } while (lastKey && items.length < limit);

    let scannedTrades = 0;
    let changedTrades = 0;
    let changedRefs = 0;

    for (const trade of items.slice(0, limit)) {
      scannedTrades += 1;
      let touched = false;
      const nextTrade: Trade = { ...trade };

      for (const field of this.tradeImageFields) {
        const arr = (trade as any)[field] as Array<any> | undefined;
        if (!Array.isArray(arr) || arr.length === 0) continue;

        const patched = arr.map((item) => {
          const refUrl = String(item?.image?.url || '').trim();
          if (!refUrl.startsWith('http')) return item;
          const key = this.extractLegacyKeyFromUrl(refUrl);
          if (!key || !key.startsWith(`images/${userId}/`)) return item;
          touched = true;
          changedRefs += 1;
          return {
            ...item,
            image: {
              ...(item?.image || {}),
              key,
              url: '',
            },
          };
        });

        (nextTrade as any)[field] = patched;
      }

      if (touched) {
        changedTrades += 1;
        if (!dryRun) {
          nextTrade.updatedAt = new Date().toISOString();
          await this.db.put({ TableName: this.tableName, Item: nextTrade });
        }
      }
    }

    return {
      success: true,
      data: {
        dryRun,
        scannedTrades,
        changedTrades,
        changedRefs,
        limit,
      },
    };
  }


  constructor(private readonly configService: ConfigService) {
    const tableName = this.configService.getOrThrow('TRANSACTIONS_TABLE_NAME');
    const region = this.configService.getOrThrow('AWS_REGION');
    console.log('[TradeService] 使用 DynamoDB 表:', tableName); // 打印环境变量的值
    this.tableName = tableName;

    // 配置 DynamoDBDocument，添加转换选项
    this.db = DynamoDBDocument.from(new DynamoDB({ region }), {
      marshallOptions: {
        convertClassInstanceToMap: true,
      },
    });
    console.log('[TradeService] db:', this.db); // 打印 db 对象
  }

  private base64Url(buf: Buffer) {
    return buf
      .toString('base64')
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replaceAll('=', '');
  }

  private generateTradeShortId() {
    // 6 bytes => 8 chars base64url, plus prefix
    return 'tr_' + this.base64Url(crypto.randomBytes(6));
  }

  private isExitedStatus(status?: string) {
    return status === '已离场' || status === '提前离场';
  }

  private isBinanceAutoImport(tradeTags?: string[]) {
    if (!Array.isArray(tradeTags)) return false;
    return tradeTags.includes('binance') && tradeTags.includes('auto-import');
  }

  private ensureExitQualityTagForExited(input: {
    status?: string;
    exitQualityTag?: string;
    tradeTags?: string[];
  }) {
    if (!this.isExitedStatus(input.status)) {
      return input.exitQualityTag;
    }

    if (input.exitQualityTag) {
      return input.exitQualityTag;
    }

    if (this.isBinanceAutoImport(input.tradeTags)) {
      return 'SYSTEM';
    }

    throw new ValidationException(
      'exitQualityTag is required when status is EXITED/EARLY_EXITED',
      ERROR_CODES.VALIDATION_REQUIRED_FIELD,
      '已离场/提前离场时，离场质量标签为必填项',
    );
  }

  private computeRiskMetrics(input: Partial<Trade>): Partial<Trade> {
    const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

    const entry = Number(input.entryPrice);
    const stop = Number(input.stopLoss);
    const tp = Number(input.takeProfit);
    const exit = Number(input.exitPrice);
    const direction = input.entryDirection;
    const status = input.status;

    if (!Number.isFinite(entry) || !Number.isFinite(stop)) {
      return {
        rMetricsReady: false,
      };
    }

    const plannedRiskPerUnit = Math.abs(entry - stop);
    if (!Number.isFinite(plannedRiskPerUnit) || plannedRiskPerUnit <= 0) {
      return {
        rMetricsReady: false,
      };
    }

    const hasTp = Number.isFinite(tp);
    const plannedRewardPerUnit = hasTp ? Math.abs(tp - entry) : undefined;
    const plannedRR =
      hasTp && plannedRewardPerUnit !== undefined
        ? plannedRewardPerUnit / plannedRiskPerUnit
        : undefined;

    let realizedR: number | undefined;
    if (Number.isFinite(exit) && (status === '已离场' || status === '提前离场')) {
      if (direction === '空') {
        const denom = stop - entry;
        if (Number.isFinite(denom) && denom > 0) {
          realizedR = (entry - exit) / denom;
        }
      } else {
        const denom = entry - stop;
        if (Number.isFinite(denom) && denom > 0) {
          realizedR = (exit - entry) / denom;
        }
      }
    }

    const rEfficiency =
      plannedRR !== undefined &&
      Number.isFinite(plannedRR) &&
      plannedRR > 0 &&
      realizedR !== undefined
        ? realizedR / plannedRR
        : undefined;

    const exitDeviationR =
      plannedRR !== undefined && Number.isFinite(plannedRR) && realizedR !== undefined
        ? plannedRR - realizedR
        : undefined;

    const rMetricsReady =
      plannedRR !== undefined &&
      Number.isFinite(plannedRR) &&
      (status === '已离场' || status === '提前离场'
        ? realizedR !== undefined && Number.isFinite(realizedR)
        : true);

    return {
      riskModelVersion: input.riskModelVersion || 'r-v1',
      plannedRiskPerUnit: plannedRiskPerUnit ? round2(plannedRiskPerUnit) : undefined,
      plannedRewardPerUnit:
        plannedRewardPerUnit !== undefined ? round2(plannedRewardPerUnit) : undefined,
      plannedRR: plannedRR !== undefined ? round2(plannedRR) : undefined,
      realizedR: realizedR !== undefined ? round2(realizedR) : undefined,
      rEfficiency: rEfficiency !== undefined ? round2(rEfficiency) : undefined,
      exitDeviationR:
        exitDeviationR !== undefined ? round2(exitDeviationR) : undefined,
      rMetricsReady,
    };
  }

  async ensureTradeShortId(userId: string, transactionId: string) {
    const tradeRes = await this.getTrade(userId, transactionId);
    const trade = tradeRes?.data as Trade | undefined;
    if (!trade) return null;
    if (trade.tradeShortId) return trade.tradeShortId;

    const shortId = this.generateTradeShortId();
    const now = new Date().toISOString();
    await this.db.update({
      TableName: this.tableName,
      Key: { userId, transactionId },
      UpdateExpression: 'SET tradeShortId = :sid, updatedAt = :u',
      ExpressionAttributeValues: {
        ':sid': shortId,
        ':u': now,
      },
    });
    return shortId;
  }

  async createTrade(userId: string, dto: CreateTradeDto) {
    const now = new Date().toISOString();
    const transactionId = (dto.transactionId || "").trim() || uuidv4();
    const tradeShortId = this.generateTradeShortId();

    const normalizedProfitLossPercentage =
      dto.profitLossPercentage === undefined ||
      dto.profitLossPercentage === null
        ? 0
        : dto.profitLossPercentage;

    if (
      typeof normalizedProfitLossPercentage !== 'number' ||
      !Number.isFinite(normalizedProfitLossPercentage)
    ) {
      throw new ValidationException(
        `profitLossPercentage must be a finite number, got: ${dto.profitLossPercentage}`,
        ERROR_CODES.VALIDATION_INVALID_VALUE,
        '盈亏百分比必须是数字，否则保存失败',
        { value: dto.profitLossPercentage },
      );
    }

    const normalizedExitQualityTag = this.ensureExitQualityTagForExited({
      status: dto.status,
      exitQualityTag: dto.exitQualityTag,
      tradeTags: dto.tradeTags,
    });

    /**
     * 创建一个新的 Trade 实例。
     *
     * @param transactionId - 交易的唯一标识符。
     * @param userId - 发起交易的用户标识。
     * @param dateTimeRange - 交易发生的时间范围。
     * @param marketStructure - 市场结构。
     * @param vah - 价值区上沿价格。
     * @param val - 价值区下沿价格。
     * @param poc - 成交量中枢价位。
     * @param entryDirection - 入场方向，可能为 'Long' 或 'Short'。
     * @param entryPrice - 入场价格。
     * @param stopLossPrice - 止损价格。
     * @param targetPrice - 止盈目标价格。
     * @param volumeProfileImage - 体积轮廓图像。
     * @param hypothesisPaths - 假设路径列表。
     * @param actualPath - 实际路径。
     * @param profitLoss - 盈亏。
     * @param rr - 风险回报率。
     * @param analysisError - 分析错误。
     * @param executionMindsetScore - 执行心态评分。
     * @param improvement - 改进措施。
     * @param createdAt - 创建时间。
     * @param updatedAt - 更新时间。
     */
    const rawTrade: Trade = {
      transactionId,
      userId,
      tradeShortId,
      tradeType: dto.tradeType,
      tradeSubject: dto.tradeSubject,
      grade: dto.grade,
      analysisTime: dto.analysisTime, // 行情分析时间
      analysisPeriod: dto.analysisPeriod, // 分析周期
      // ===== 分享相关 =====
      isShareable: false,
      // ===== 交易状态 =====
      status: dto.status,
      // ===== 入场前分析 =====
      volumeProfileImages: dto.volumeProfileImages,
      marketStructureAnalysisImages: dto.marketStructureAnalysisImages,
      trendAnalysisImages: dto.trendAnalysisImages,
      poc: dto.poc,
      val: dto.val,
      vah: dto.vah,
      keyPriceLevels: dto.keyPriceLevels,
      marketStructure: dto.marketStructure,
      marketStructureAnalysis: dto.marketStructureAnalysis,
      expectedPathImages: dto.expectedPathImages,
      expectedPathImagesDetailed: dto.expectedPathImagesDetailed,
      expectedPathAnalysis: dto.expectedPathAnalysis,
      entryPlanA: dto.entryPlanA,
      entryPlanB: dto.entryPlanB,
      entryPlanC: dto.entryPlanC,
      checklist: dto.checklist,
      // ===== 入场记录 =====
      entryPrice: dto.entryPrice,
      entryTime: dto.entryTime,
      entryDirection: dto.entryDirection,
      stopLoss: dto.stopLoss,
      takeProfit: dto.takeProfit,
      mentalityNotes: dto.mentalityNotes,
      entryAnalysisImages: dto.entryAnalysisImages,
      entryAnalysisImagesDetailed: dto.entryAnalysisImagesDetailed,
      // ===== 离场后分析 =====
      exitPrice: dto.exitPrice,
      exitTime: dto.exitTime,
      tradeResult: dto.tradeResult,
      followedPlan: dto.followedPlan,
      actualPathImages: dto.actualPathImages,
      actualPathImagesDetailed: dto.actualPathImagesDetailed,
      actualPathAnalysis: dto.actualPathAnalysis,
      tradeTags: dto.tradeTags,
      remarks: dto.remarks,
      lessonsLearned: dto.lessonsLearned,
      analysisImages: dto.analysisImages,
      analysisImagesDetailed: dto.analysisImagesDetailed,
      // R模型字段
      riskModelVersion: dto.riskModelVersion,
      plannedRiskAmount: dto.plannedRiskAmount,
      plannedRiskPct: dto.plannedRiskPct,
      maxFavorableExcursionR: dto.maxFavorableExcursionR,
      maxAdverseExcursionR: dto.maxAdverseExcursionR,
      exitType: dto.exitType,
      exitQualityTag: dto.exitQualityTag,
      exitReasonCode: dto.exitReasonCode,
      exitReasonNote: dto.exitReasonNote,
      // 基础计算字段
      profitLossPercentage: normalizedProfitLossPercentage,
      riskRewardRatio: dto.riskRewardRatio,
      followedSystemStrictly: dto.followedSystemStrictly,
      createdAt: now,
      updatedAt: now,
    };

    const newTrade: Trade = this.sanitizeTradeImageUrlsForStorage({
      ...rawTrade,
      ...this.computeRiskMetrics(rawTrade),
    });
    console.log('[TradeService] createTrade userId:', userId);
    try {
      await this.db.put({
        TableName: this.tableName,
        Item: newTrade,
      });

      return {
        success: true,
        message: '创建成功',
        data: newTrade,
      };
    } catch (error) {
      console.error('[TradeService] createTrade error:', error);
      throw new DynamoDBException(
        `交易创建失败: ${error.message}`,
        ERROR_CODES.DYNAMODB_OPERATION_FAILED,
        '交易创建失败，请稍后重试',
        { originalError: error.message },
      );
    }
  }
  /**
   * 获取本月已离场交易数与胜率统计
   * @param userId 用户ID
   * @returns { thisMonthClosedTradeCount, thisMonthWinRate }
   */
  async getThisMonthStats(userId: string) {
    // 计算本月起止
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1); // 不含
    const monthStartStr = monthStart.toISOString();
    const monthEndStr = monthEnd.toISOString();

    // 查询该用户所有 createdAt 在本月记录，后续用 JS 过滤已离场
    // 注意 DynamoDB 分区键为 userId，createdAt 仅可做附加过滤
    try {
      const result = await this.db.query({
        TableName: this.tableName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
        // createdAt 过滤更优时可用范围查询，这里用 JS 过滤保证通用
      });
      const items = (result.Items || []) as Trade[];
      // 只取本月记录
      const monthTrades = items.filter(
        (t) =>
          t.createdAt >= monthStartStr &&
          t.createdAt < monthEndStr &&
          t.status === '已离场',
      );

      const thisMonthClosedTradeCount = monthTrades.length;
      const winCount = monthTrades.filter(
        (t) => t.tradeResult === TradeResult.PROFIT,
      ).length;
      // 避免分母为0
      const thisMonthWinRate =
        thisMonthClosedTradeCount === 0
          ? 0
          : Math.round((winCount / thisMonthClosedTradeCount) * 100);

      return {
        thisMonthClosedTradeCount,
        thisMonthWinRate,
      };
    } catch (error) {
      console.error('[TradeService] getThisMonthStats error:', error);
      throw new DynamoDBException(
        `交易统计获取失败: ${error.message}`,
        ERROR_CODES.DYNAMODB_OPERATION_FAILED,
        '交易统计获取失败，请稍后重试',
        { originalError: error.message },
      );
    }
  }

  async findByUserId(userId: string, page = 1, pageSize = 20) {
    try {
      const safePage = Math.max(1, page);
      const safePageSize = Math.max(1, pageSize);

      // 基于 createdAt 索引获取总数
      const countResult = await this.db.query({
        TableName: this.tableName,
        IndexName: this.createdAtIndexName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
        Select: 'COUNT',
      });
      const total = countResult.Count || 0;

      if (total === 0) {
        return {
          success: true,
          data: {
            items: [],
            total: 0,
            page: safePage,
            pageSize: safePageSize,
            totalPages: 0,
          },
        };
      }

      const totalPages = Math.ceil(total / safePageSize);
      const pagedItems = await this.queryCreatedAtIndexPage(
        userId,
        safePage,
        safePageSize,
      );

      return {
        success: true,
        data: {
          items: pagedItems,
          total,
          page: safePage,
          pageSize: safePageSize,
          totalPages,
        },
      };
    } catch (error) {
      console.error(
        '[TradeService] findByUserId error:',
        JSON.stringify(error),
      );
      // console.error('[TradeService] findByUserId error:', error);
      throw new DynamoDBException(
        `交易列表获取失败: ${error.message}`,
        ERROR_CODES.DYNAMODB_OPERATION_FAILED,
        '交易列表获取失败，请稍后重试',
        { originalError: error.message },
      );
    }
  }
  /**
   * 结合筛选条件的分页查询（POST）
   */
  async findByUserQuery(userId: string, dto: TradeQueryDto) {
    const {
      page = 1,
      limit,
      type,
      grade,
      marketStructure,
      entryDirection,
      tradeStatus,
      tradeResult,
      followedSystemStrictly,
      tradeTags,
      dateTimeRange,
      tradeType,
      analysisPeriod,
      dateFrom,
      dateTo,
    } = dto;

    const pageSize = limit ?? dto.pageSize ?? 20;

    try {
      // 使用 createdAt 索引按创建时间倒序拉取（顺序由索引保证）
      let items = await this.queryAllByCreatedAtDesc(userId);

      // u4f7fu7528 tradeType u53c2u6570u8fdbu884cu8fc7u6ee4uff0cu4f18u5148u7ea7u9ad8u4e8e type u53c2u6570
      if (tradeType && tradeType !== 'all')
        items = items.filter((t) => t.tradeType === tradeType);
      else if (type && type !== 'all')
        items = items.filter((t) => t.tradeType === type);
      if (analysisPeriod && analysisPeriod !== 'all')
        items = items.filter((t) => t.analysisPeriod === analysisPeriod);
      if (grade && grade !== 'all')
        items = items.filter((t) => t.grade === grade);
      if (marketStructure && marketStructure !== 'all')
        items = items.filter((t) => t.marketStructure === marketStructure);
      if (entryDirection && entryDirection !== 'all')
        items = items.filter((t) => t.entryDirection === entryDirection);
      if (tradeStatus && tradeStatus !== 'all')
        items = items.filter((t) => t.status === tradeStatus);
      if (tradeResult && tradeResult !== 'all')
        items = items.filter((t) => t.tradeResult === tradeResult);
      if (typeof followedSystemStrictly === 'boolean')
        items = items.filter(
          (t) => t.followedSystemStrictly === followedSystemStrictly,
        );
      if (tradeTags && tradeTags.length > 0)
        items = items.filter((t) => {
          const tags = t.tradeTags || [];
          return tradeTags.some((tag) => tags.includes(tag));
        });
      // 处理日期范围查询 - 支持两种方式：dateTimeRange 对象或 dateFrom/dateTo 参数
      let fromDate = '';
      let toDate = '';

      // 处理 dateTimeRange 对象
      if (dateTimeRange && (dateTimeRange.from || dateTimeRange.to)) {
        if (dateTimeRange.from) {
          try {
            fromDate = new Date(dateTimeRange.from).toISOString().split('T')[0];
          } catch {
            console.error('Invalid dateTimeRange.from:', dateTimeRange.from);
          }
        }

        if (dateTimeRange.to) {
          try {
            const endDate = new Date(dateTimeRange.to);
            endDate.setHours(23, 59, 59, 999);
            toDate = endDate.toISOString();
          } catch {
            console.error('Invalid dateTimeRange.to:', dateTimeRange.to);
          }
        }
      }

      // 处理直接传入的 dateFrom/dateTo 参数（优先级高于 dateTimeRange）
      if (dateFrom) {
        try {
          fromDate = new Date(dateFrom).toISOString().split('T')[0];
        } catch {
          console.error('Invalid dateFrom:', dateFrom);
        }
      }

      if (dateTo) {
        try {
          const endDate = new Date(dateTo);
          endDate.setHours(23, 59, 59, 999);
          toDate = endDate.toISOString();
        } catch {
          console.error('Invalid dateTo:', dateTo);
        }
      }

      // 应用日期过滤
      if (fromDate || toDate) {
        items = items.filter((t) => {
          // 使用 createdAt 或 analysisTime 作为比较字段
          const itemDate = t.createdAt || t.analysisTime || '';
          if (!itemDate) return true; // 如果记录没有日期，则默认显示

          // 只有开始日期
          if (fromDate && !toDate) {
            return itemDate >= fromDate;
          }

          // 只有结束日期
          if (!fromDate && toDate) {
            return itemDate <= toDate;
          }

          // 同时有开始和结束日期
          return itemDate >= fromDate && itemDate <= toDate;
        });
      }

      const total = items.length;
      const totalPages = Math.ceil(total / pageSize) || 1;
      const start = (page - 1) * pageSize;
      const paged = items.slice(start, start + pageSize);

      return {
        success: true,
        data: {
          items: paged,
          total,
          page,
          pageSize,
          totalPages,
        },
      };
    } catch (error) {
      console.error('[TradeService] findByUserQuery error:', error);
      throw new DynamoDBException(
        `筛选查询失败: ${error.message}`,
        ERROR_CODES.DYNAMODB_OPERATION_FAILED,
        '交易列表获取失败，请稍后重试',
        { originalError: error.message },
      );
    }
  }

  private buildSummaryPage(
    trades: Trade[],
    page: number,
    pageSize: number,
    summaryType: 'pre' | 'post',
  ) {
    const items = trades
      .filter((trade) => {
        if (summaryType === 'pre') {
          return (
            typeof trade.preEntrySummary === 'string' &&
            trade.preEntrySummary.trim().length > 0
          );
        }
        return (
          typeof trade.lessonsLearned === 'string' &&
          trade.lessonsLearned.trim().length > 0
        );
      })
      .map((trade) => {
        return {
          transactionId: trade.transactionId,
          text:
            summaryType === 'pre'
              ? (trade.preEntrySummary ?? '')
              : (trade.lessonsLearned ?? ''),
          importance:
            summaryType === 'pre'
              ? (trade.preEntrySummaryImportance ?? 0)
              : (trade.lessonsLearnedImportance ?? 0),
        };
      });

    const total = items.length;
    if (total === 0) {
      return {
        items: [],
        total: 0,
        totalPages: 0,
      };
    }

    const totalPages = Math.ceil(total / pageSize) || 0;
    const start = (page - 1) * pageSize;
    const pagedItems = items
      .slice(start, start + pageSize)
      .map(({ transactionId, text, importance }) => ({
        transactionId,
        text,
        importance,
      }));

    return {
      items: pagedItems,
      total,
      totalPages,
    };
  }

  private async queryAllByCreatedAtDesc(userId: string) {
    const items: Trade[] = [];
    let lastKey: Record<string, any> | undefined;

    do {
      const result = await this.db.query({
        TableName: this.tableName,
        IndexName: this.createdAtIndexName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
        ScanIndexForward: false,
        ExclusiveStartKey: lastKey,
      });

      items.push(...((result.Items || []) as Trade[]));
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    return items;
  }

  /**
   * 基于 createdAt 索引，按创建时间倒序获取指定页。
   * 由于接口使用 page/pageSize，这里通过 ExclusiveStartKey 逐页推进到目标页。
   */
  private async queryCreatedAtIndexPage(
    userId: string,
    page: number,
    pageSize: number,
  ) {
    let currentPage = 1;
    let lastKey: Record<string, any> | undefined;

    while (currentPage <= page) {
      const result = await this.db.query({
        TableName: this.tableName,
        IndexName: this.createdAtIndexName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
        ScanIndexForward: false,
        Limit: pageSize,
        ExclusiveStartKey: lastKey,
      });

      const pageItems = (result.Items || []) as Trade[];
      if (currentPage === page) {
        return pageItems;
      }

      lastKey = result.LastEvaluatedKey;
      if (!lastKey) {
        return [];
      }

      currentPage += 1;
    }

    return [];
  }

  private buildFiveStarSummaryCandidates(trades: Trade[]) {
    const items: Array<{
      transactionId: string;
      summary: string;
      summaryType: 'pre' | 'post';
    }> = [];

    trades.forEach((trade) => {
      if (
        trade.preEntrySummaryImportance === 5 &&
        typeof trade.preEntrySummary === 'string' &&
        trade.preEntrySummary.trim().length > 0
      ) {
        items.push({
          transactionId: trade.transactionId,
          summary: trade.preEntrySummary,
          summaryType: 'pre',
        });
      }

      if (
        trade.lessonsLearnedImportance === 5 &&
        typeof trade.lessonsLearned === 'string' &&
        trade.lessonsLearned.trim().length > 0
      ) {
        items.push({
          transactionId: trade.transactionId,
          summary: trade.lessonsLearned,
          summaryType: 'post',
        });
      }
    });

    return items;
  }

  private shuffleItems<T>(items: T[]) {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private getTradeSortTime(trade: Trade) {
    const time = trade.exitTime || trade.updatedAt || trade.createdAt;
    const parsed = Date.parse(time || '');
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  private getCreatedSortTime(trade: Trade) {
    const parsed = Date.parse(trade.createdAt || '');
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  private calculateWinRate(trades: Trade[]) {
    const eligible = trades.filter((trade) => trade.tradeResult);
    const total = eligible.length;
    if (total === 0) return 0;
    const winCount = eligible.filter(
      (trade) => trade.tradeResult === TradeResult.PROFIT,
    ).length;
    return Math.round((winCount / total) * 100);
  }

  private normalizeDateKey(date: Date) {
    return date.toISOString().split('T')[0];
  }

  private buildDateRange(range: '7d' | '30d' | '3m') {
    const now = new Date();
    const startDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const endDate = new Date(startDate);
    endDate.setUTCHours(23, 59, 59, 999);

    if (range === '3m') {
      startDate.setUTCMonth(startDate.getUTCMonth() - 3);
    } else {
      const days = range === '7d' ? 7 : 30;
      startDate.setUTCDate(startDate.getUTCDate() - (days - 1));
    }

    const dates: string[] = [];
    for (
      let cursor = new Date(startDate);
      cursor <= endDate;
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    ) {
      dates.push(this.normalizeDateKey(cursor));
    }

    return { startDate, endDate, dates };
  }

  async getWinRateTrend(userId: string, range: '7d' | '30d' | '3m') {
    try {
      const { startDate, endDate, dates } = this.buildDateRange(range);
      const startIso = startDate.toISOString();
      const endIso = endDate.toISOString();

      const [simulationResult, realResult] = await Promise.all([
        this.db.query({
          TableName: this.tableName,
          IndexName: 'userId-createdAt-index',
          KeyConditionExpression:
            'userId = :userId AND createdAt BETWEEN :start AND :end',
          FilterExpression: 'tradeType = :simulation',
          ExpressionAttributeValues: {
            ':userId': userId,
            ':start': startIso,
            ':end': endIso,
            ':simulation': TradeType.SIMULATION,
          },
        }),
        this.db.query({
          TableName: this.tableName,
          IndexName: 'userId-exitTime-index',
          KeyConditionExpression:
            'userId = :userId AND #exitTime BETWEEN :start AND :end',
          FilterExpression: 'tradeType = :real',
          ExpressionAttributeNames: {
            '#exitTime': 'exitTime',
          },
          ExpressionAttributeValues: {
            ':userId': userId,
            ':start': startIso,
            ':end': endIso,
            ':real': TradeType.REAL,
          },
        }),
      ]);

      const simulationItems = (simulationResult.Items || []) as Trade[];
      const realItems = (realResult.Items || []) as Trade[];
      const buckets = {
        simulation: new Map<
          string,
          { wins: number; losses: number; total: number }
        >(),
        real: new Map<
          string,
          { wins: number; losses: number; total: number }
        >(),
      };

      const applyTrade = (
        trade: Trade,
        time: string | undefined,
        target: Map<string, { wins: number; losses: number; total: number }>,
      ) => {
        if (!trade.tradeResult) return;
        if (!time) return;
        const dateKey = this.normalizeDateKey(new Date(time));
        const current = target.get(dateKey) || { wins: 0, losses: 0, total: 0 };
        current.total += 1;
        if (trade.tradeResult === TradeResult.PROFIT) {
          current.wins += 1;
        } else if (trade.tradeResult === TradeResult.LOSS) {
          current.losses += 1;
        }
        target.set(dateKey, current);
      };

      simulationItems.forEach((trade) =>
        applyTrade(trade, trade.createdAt, buckets.simulation),
      );
      realItems.forEach((trade) =>
        applyTrade(trade, trade.exitTime, buckets.real),
      );

      const buildSeries = (
        bucket: Map<string, { wins: number; losses: number; total: number }>,
      ) =>
        dates.map((date) => {
          const stats = bucket.get(date);
          if (!stats || stats.total === 0) {
            return { date, winRate: 0, total: 0, profit: 0, loss: 0 };
          }
          return {
            date,
            winRate: Math.round((stats.wins / stats.total) * 100),
            total: stats.total,
            profit: stats.wins,
            loss: stats.losses,
          };
        });

      return {
        success: true,
        data: {
          range,
          simulation: buildSeries(buckets.simulation),
          real: buildSeries(buckets.real),
        },
      };
    } catch (error) {
      console.error('[TradeService] getWinRateTrend error:', error);
      throw new DynamoDBException(
        `交易胜率趋势获取失败: ${error.message}`,
        ERROR_CODES.DYNAMODB_OPERATION_FAILED,
        '交易胜率趋势获取失败，请稍后重试',
        { originalError: error.message },
      );
    }
  }

  /**
   * 分页获取交易事前总结列表
   * @param userId 用户ID
   * @param page 页码，默认为1
   * @param pageSize 每页数量，默认为20，最大100
   */
  async getPreEntrySummaries(userId: string, page = 1, pageSize = 20) {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(Math.max(pageSize, 1), 100);

    try {
      const allTrades = await this.queryAllByCreatedAtDesc(userId);
      const { items, total, totalPages } = this.buildSummaryPage(
        allTrades,
        safePage,
        safePageSize,
        'pre',
      );

      return {
        success: true,
        data: {
          items,
          total,
          page: safePage,
          pageSize: safePageSize,
          totalPages,
        },
      };
    } catch (error) {
      console.error('[TradeService] getPreEntrySummaries error:', error);
      throw new DynamoDBException(
        `交易事前总结获取失败: ${error.message}`,
        ERROR_CODES.DYNAMODB_OPERATION_FAILED,
        '交易事前总结获取失败，请稍后重试',
        { originalError: error.message },
      );
    }
  }

  /**
   * 分页获取交易事后总结列表
   * @param userId 用户ID
   * @param page 页码，默认为1
   * @param pageSize 每页数量，默认为20，最大100
   */
  async getPostTradeSummaries(userId: string, page = 1, pageSize = 20) {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(Math.max(pageSize, 1), 100);

    try {
      const allTrades = await this.queryAllByCreatedAtDesc(userId);
      const { items, total, totalPages } = this.buildSummaryPage(
        allTrades,
        safePage,
        safePageSize,
        'post',
      );

      return {
        success: true,
        data: {
          items,
          total,
          page: safePage,
          pageSize: safePageSize,
          totalPages,
        },
      };
    } catch (error) {
      console.error('[TradeService] getPostTradeSummaries error:', error);
      throw new DynamoDBException(
        `交易事后总结获取失败: ${error.message}`,
        ERROR_CODES.DYNAMODB_OPERATION_FAILED,
        '交易事后总结获取失败，请稍后重试',
        { originalError: error.message },
      );
    }
  }

  /**
   * 随机获取五星交易总结（事前/事后）
   * @param userId 用户ID
   * @param sampleSize 随机抽取数量，默认5
   * @param returnSize 返回数量，默认3
   */
  async getRandomFiveStarSummaries(
    userId: string,
    sampleSize = 5,
    returnSize = 3,
  ) {
    const safeSampleSize = Math.max(1, sampleSize);
    const safeReturnSize = Math.max(1, returnSize);

    try {
      const result = await this.db.query({
        TableName: this.tableName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
        ScanIndexForward: false,
      });

      const allTrades = (result.Items || []) as Trade[];
      const candidates = this.buildFiveStarSummaryCandidates(allTrades);
      const sampled = this.shuffleItems(candidates).slice(0, safeSampleSize);
      const items = this.shuffleItems(sampled).slice(0, safeReturnSize);

      return {
        success: true,
        data: {
          items,
        },
      };
    } catch (error) {
      console.error('[TradeService] getRandomFiveStarSummaries error:', error);
      throw new DynamoDBException(
        `随机交易总结获取失败: ${error.message}`,
        ERROR_CODES.DYNAMODB_OPERATION_FAILED,
        '随机交易总结获取失败，请稍后重试',
        { originalError: error.message },
      );
    }
  }

  async getDashboardData(userId: string) {
    try {
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      const lastMonthStartIso = lastMonthStart.toISOString();
      const nextMonthStartIso = nextMonthStart.toISOString();

      const thisMonthStartMs = thisMonthStart.getTime();
      const nextMonthStartMs = nextMonthStart.getTime();
      const lastMonthStartMs = lastMonthStart.getTime();

      let thisMonthTradeCount = 0;
      let lastMonthTradeCount = 0;
      let thisMonthSimulationTradeCount = 0;
      let lastMonthSimulationTradeCount = 0;

      const [realTradesByExitTime, simulationTradesByCreatedAt] =
        await Promise.all([
          this.db.query({
            TableName: this.tableName,
            IndexName: 'userId-exitTime-index',
            KeyConditionExpression:
              'userId = :userId AND #exitTime BETWEEN :lastMonthStart AND :nextMonthStart',
            ExpressionAttributeNames: {
              '#exitTime': 'exitTime',
            },
            ExpressionAttributeValues: {
              ':userId': userId,
              ':lastMonthStart': lastMonthStartIso,
              ':nextMonthStart': nextMonthStartIso,
              ':real': TradeType.REAL,
            },
            FilterExpression: 'tradeType = :real',
          }),
          this.db.query({
            TableName: this.tableName,
            IndexName: 'userId-createdAt-index',
            KeyConditionExpression:
              'userId = :userId AND createdAt BETWEEN :lastMonthStart AND :nextMonthStart',
            ExpressionAttributeValues: {
              ':userId': userId,
              ':lastMonthStart': lastMonthStartIso,
              ':nextMonthStart': nextMonthStartIso,
              ':simulation': TradeType.SIMULATION,
            },
            FilterExpression: 'tradeType = :simulation',
          }),
        ]);

      const realTrades = (realTradesByExitTime.Items || []) as Trade[];
      const simulationTrades = (simulationTradesByCreatedAt.Items ||
        []) as Trade[];

      realTrades.forEach((trade) => {
        const exitTimeMs = Date.parse(trade.exitTime || '');
        if (Number.isNaN(exitTimeMs)) return;
        if (exitTimeMs >= thisMonthStartMs && exitTimeMs < nextMonthStartMs) {
          thisMonthTradeCount += 1;
        } else if (
          exitTimeMs >= lastMonthStartMs &&
          exitTimeMs < thisMonthStartMs
        ) {
          lastMonthTradeCount += 1;
        }
      });

      simulationTrades.forEach((trade) => {
        const createdAtMs = Date.parse(trade.createdAt || '');
        if (Number.isNaN(createdAtMs)) return;
        if (createdAtMs >= thisMonthStartMs && createdAtMs < nextMonthStartMs) {
          thisMonthSimulationTradeCount += 1;
        } else if (
          createdAtMs >= lastMonthStartMs &&
          createdAtMs < thisMonthStartMs
        ) {
          lastMonthSimulationTradeCount += 1;
        }
      });

      const fetchRecentClosedTrades = async (
        indexName: string,
        tradeType: TradeType,
        maxItems: number,
      ) => {
        const items: Trade[] = [];
        let lastKey: Record<string, any> | undefined;
        do {
          const pageSize = 100;
          const result = await this.db.query({
            TableName: this.tableName,
            IndexName: indexName,
            KeyConditionExpression: 'userId = :userId',
            FilterExpression:
              '(#status = :exited OR #status = :earlyExited) AND tradeType = :tradeType',
            ExpressionAttributeNames: {
              '#status': 'status',
            },
            ExpressionAttributeValues: {
              ':userId': userId,
              ':exited': '已离场',
              ':earlyExited': '提前离场',
              ':tradeType': tradeType,
            },
            ScanIndexForward: false,
            Limit: pageSize,
            ExclusiveStartKey: lastKey,
          });
          const pageItems = (result.Items || []) as Trade[];
          items.push(...pageItems);
          lastKey = result.LastEvaluatedKey;
        } while (lastKey && items.length < maxItems);

        return items.slice(0, maxItems);
      };

      const [recentClosedRealTrades, recentClosedSimulationTrades] =
        await Promise.all([
          fetchRecentClosedTrades('userId-exitTime-index', TradeType.REAL, 60),
          fetchRecentClosedTrades(
            'userId-createdAt-index',
            TradeType.SIMULATION,
            60,
          ),
        ]);

      const recent30Trades = recentClosedRealTrades.slice(0, 30);
      const previous30Trades = recentClosedRealTrades.slice(30, 60);

      const recent30WinRate = this.calculateWinRate(recent30Trades);
      const previous30WinRate = this.calculateWinRate(previous30Trades);

      const recent30SimulationTrades = recentClosedSimulationTrades.slice(
        0,
        30,
      );
      const previous30SimulationTrades = recentClosedSimulationTrades.slice(
        30,
        60,
      );

      const recent30SimulationWinRate = this.calculateWinRate(
        recent30SimulationTrades,
      );
      const previous30SimulationWinRate = this.calculateWinRate(
        previous30SimulationTrades,
      );

      const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

      const numOrNull = (value: unknown): number | null => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      };

      const calculateAvgProfitLossPercentage = (trades: Trade[]) => {
        if (trades.length === 0) return 0;

        const sum = trades.reduce((acc, trade) => {
          const value = (trade as any).profitLossPercentage;
          // 兼容历史数据：可能是 number，也可能是可解析的字符串
          if (typeof value === 'number' && Number.isFinite(value))
            return acc + value;
          if (typeof value === 'string') {
            const parsed = Number(value);
            if (Number.isFinite(parsed)) return acc + parsed;
          }
          // 缺失/不合法：按 0 处理
          return acc;
        }, 0);

        // 保留2位小数，方便图表展示
        return round2(sum / trades.length);
      };

      const calculateDisciplineStats = (
        recent: Trade[],
        previous: Trade[],
      ) => {
        const scoreTrade = (t: Trade) => {
          let score = 100;

          const followedPlan = (t as any).followedPlan;
          const followedSystemStrictly = (t as any).followedSystemStrictly;
          const exitTag = String((t as any).exitQualityTag || '').toUpperCase();
          const remarks = String((t as any).remarks || '').trim();
          const lessonsLearned = String((t as any).lessonsLearned || '').trim();

          if (followedPlan === false) score -= 20;
          if (followedSystemStrictly === false) score -= 15;
          if (exitTag === 'EMOTIONAL') score -= 25;
          if (exitTag === 'UNKNOWN' || !exitTag) score -= 10;
          if (!remarks) score -= 10;
          if (!lessonsLearned) score -= 10;

          if (score < 0) score = 0;
          if (score > 100) score = 100;
          return score;
        };

        const avgScore = (arr: Trade[]) => {
          if (!arr.length) return 0;
          const total = arr.reduce((acc, t) => acc + scoreTrade(t), 0);
          return round2(total / arr.length);
        };

        const breakdown = recent.reduce(
          (acc, t) => {
            if ((t as any).followedPlan === false) acc.notFollowedPlan += 1;
            if (String((t as any).exitQualityTag || '').toUpperCase() === 'EMOTIONAL') {
              acc.emotionalExit += 1;
            }
            const remarks = String((t as any).remarks || '').trim();
            const lessonsLearned = String((t as any).lessonsLearned || '').trim();
            if (!remarks || !lessonsLearned) acc.missingReviewNotes += 1;
            return acc;
          },
          { notFollowedPlan: 0, emotionalExit: 0, missingReviewNotes: 0 },
        );

        const recentAvg = avgScore(recent);
        const previousAvg = avgScore(previous);
        const delta = round2(recentAvg - previousAvg);

        const level =
          recentAvg >= 80 ? 'excellent' : recentAvg >= 60 ? 'fair' : 'needs_improvement';

        return {
          avgScore: recentAvg,
          previousAvgScore: previousAvg,
          delta,
          level,
          sampleCount: recent.length,
          scoreVersion: 'v1',
          breakdown,
        };
      };

      const calculateRStats = (trades: Trade[]) => {
        const plannedRRValues = trades
          .map((t) => numOrNull((t as any).plannedRR))
          .filter((v): v is number => v !== null);
        const realizedRValues = trades
          .map((t) => numOrNull((t as any).realizedR))
          .filter((v): v is number => v !== null);
        const rEfficiencyValues = trades
          .map((t) => numOrNull((t as any).rEfficiency))
          .filter((v): v is number => v !== null);

        const avg = (values: number[]) =>
          values.length > 0
            ? round2(values.reduce((a, b) => a + b, 0) / values.length)
            : 0;

        const expectancyR = avg(realizedRValues);
        const avgPlannedRR = avg(plannedRRValues);
        const avgRealizedR = avg(realizedRValues);
        const avgREfficiency = avg(rEfficiencyValues);

        const quality = { TECHNICAL: 0, EMOTIONAL: 0, SYSTEM: 0, UNKNOWN: 0 };
        trades.forEach((t) => {
          const tag = String((t as any).exitQualityTag || 'UNKNOWN').toUpperCase();
          if (tag === 'TECHNICAL') quality.TECHNICAL += 1;
          else if (tag === 'EMOTIONAL') quality.EMOTIONAL += 1;
          else if (tag === 'SYSTEM') quality.SYSTEM += 1;
          else quality.UNKNOWN += 1;
        });

        const emotionalRealizedRValues = trades
          .filter((t) => String((t as any).exitQualityTag || '').toUpperCase() === 'EMOTIONAL')
          .map((t) => numOrNull((t as any).realizedR))
          .filter((v): v is number => v !== null);

        const technicalRealizedRValues = trades
          .filter((t) => String((t as any).exitQualityTag || '').toUpperCase() === 'TECHNICAL')
          .map((t) => numOrNull((t as any).realizedR))
          .filter((v): v is number => v !== null);

        const emotionalAvgR = avg(emotionalRealizedRValues);
        const technicalAvgR = avg(technicalRealizedRValues);
        const emotionalCount = emotionalRealizedRValues.length;

        // v2: 样本归一化的情绪泄露估算
        // emotionalLeakageR = max(0, (technicalAvgR - emotionalAvgR) * emotionalCount)
        const emotionalLeakageR = round2(
          Math.max(0, (technicalAvgR - emotionalAvgR) * emotionalCount),
        );

        let emotionalLeakageConfidence: 'low' | 'medium' | 'high' = 'high';
        if (technicalRealizedRValues.length < 5 || emotionalRealizedRValues.length < 5) {
          emotionalLeakageConfidence = 'low';
        } else if (
          technicalRealizedRValues.length < 10 ||
          emotionalRealizedRValues.length < 10
        ) {
          emotionalLeakageConfidence = 'medium';
        }

        return {
          expectancyR,
          avgPlannedRR,
          avgRealizedR,
          avgREfficiency,
          emotionalLeakageR,
          emotionalLeakageConfidence,
          qualityDistribution: quality,
        };
      };

      // 两种交易数量字段（用于图表）
      const recent30RealTradeCount = recent30Trades.length;
      const recent30SimulationTradeCount = recent30SimulationTrades.length;

      // 近30笔 vs 之前30笔（60-30）综合盈亏对比（真实交易）
      const recent30ProfitLossAvg =
        calculateAvgProfitLossPercentage(recent30Trades);
      const previous30ProfitLossAvg =
        calculateAvgProfitLossPercentage(previous30Trades);

      // 近30笔 vs 之前30笔（60-30）综合盈亏对比（模拟交易）
      const recent30SimulationProfitLossAvg = calculateAvgProfitLossPercentage(
        recent30SimulationTrades,
      );
      const previous30SimulationProfitLossAvg =
        calculateAvgProfitLossPercentage(previous30SimulationTrades);

      const recent30RStats = calculateRStats(recent30Trades);
      const recent30SimulationRStats = calculateRStats(recent30SimulationTrades);
      const recent30DisciplineStats = calculateDisciplineStats(
        recent30Trades,
        previous30Trades,
      );
      const recent30SimulationDisciplineStats = calculateDisciplineStats(
        recent30SimulationTrades,
        previous30SimulationTrades,
      );

      const summaryResult = await this.getRandomFiveStarSummaries(userId);
      const summaryHighlights = summaryResult.data?.items ?? [];

      const recentTradesResult = await this.db.query({
        TableName: this.tableName,
        IndexName: 'userId-createdAt-index',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
        ScanIndexForward: false,
        Limit: 5,
      });
      const recentTrades = (recentTradesResult.Items || []) as Trade[];

      return {
        success: true,
        data: {
          thisMonthTradeCount,
          lastMonthTradeCount,
          recent30WinRate,
          previous30WinRate,
          thisMonthSimulationTradeCount,
          lastMonthSimulationTradeCount,
          recent30SimulationWinRate,
          previous30SimulationWinRate,
          recent30RealTradeCount,
          recent30SimulationTradeCount,
          recent30ProfitLossAvg,
          previous30ProfitLossAvg,
          recent30SimulationProfitLossAvg,
          previous30SimulationProfitLossAvg,
          recent30RStats,
          recent30SimulationRStats,
          recent30DisciplineStats,
          recent30SimulationDisciplineStats,
          summaryHighlights,
          recentTrades,
        },
      };
    } catch (error) {
      console.error('[TradeService] getDashboardData error:', error);
      throw new DynamoDBException(
        `仪表盘数据获取失败: ${error.message}`,
        ERROR_CODES.DYNAMODB_OPERATION_FAILED,
        '仪表盘数据获取失败，请稍后重试',
        { originalError: error.message },
      );
    }
  }

  async getTrade(userId: string, transactionId: string) {
    try {
      const result = await this.db.get({
        TableName: this.tableName,
        Key: { userId, transactionId },
      });

      if (!result.Item) {
        return {
          success: false,
          message: '交易记录不存在',
        };
      }
      // 权限校验: Trade 必须属当前 userId
      if (result.Item.userId !== userId) {
        throw new AuthorizationException(
          `用户 ${userId} 试图访问不属于自己的交易记录 ${transactionId}`,
          ERROR_CODES.TRADE_ACCESS_DENIED,
          '您没有权限访问此交易记录',
        );
      }
      return {
        success: true,
        data: result.Item as Trade,
      };
    } catch (error) {
      console.error('[TradeService] getTrade error:', error);
      if (error instanceof AuthorizationException) {
        throw error;
      }
      throw new DynamoDBException(
        `单个交易获取失败: ${error.message}`,
        ERROR_CODES.DYNAMODB_OPERATION_FAILED,
        '交易记录获取失败，请稍后重试',
        { originalError: error.message },
      );
    }
  }

  async shareTrade(userId: string, transactionId: string) {
    const result = await this.updateShareable(userId, transactionId, true);
    return {
      success: true,
      message: '分享成功',
      data: result.data,
    };
  }

  async updateShareable(
    userId: string,
    transactionId: string,
    isShareable: boolean,
  ) {
    try {
      this.logger.log(
        `[TradeService] updateShareable start table=${this.tableName}`,
      );
      const oldRes = await this.getTrade(userId, transactionId);
      if (!oldRes.success) {
        throw new ResourceNotFoundException(
          `交易记录不存在: userId=${userId}, transactionId=${transactionId}`,
          ERROR_CODES.TRADE_NOT_FOUND,
          '交易记录不存在',
        );
      }

      const existingTrade = oldRes.data as Trade;
      const now = new Date().toISOString();
      const updated: Trade = {
        ...existingTrade,
        isShareable,
        updatedAt: now,
      };

      if (isShareable) {
        updated.shareId = existingTrade.shareId ?? uuidv4();
      } else if (updated.shareId) {
        delete updated.shareId;
      }

      await this.db.put({
        TableName: this.tableName,
        Item: updated,
      });
      this.logger.log(
        `[TradeService] updateShareable done table=${this.tableName} transactionId=${updated.transactionId} shareId=${updated.shareId} isShareable=${updated.isShareable}`,
      );

      return {
        success: true,
        message: '更新成功',
        data: {
          transactionId: updated.transactionId,
          isShareable: updated.isShareable ?? false,
          shareId: updated.shareId,
        },
      };
    } catch (error) {
      console.error('[TradeService] updateShareable error:', error);
      if (error instanceof ResourceNotFoundException) {
        throw error;
      }
      throw new DynamoDBException(
        `交易分享状态更新失败: ${error.message}`,
        ERROR_CODES.DYNAMODB_OPERATION_FAILED,
        '交易分享状态更新失败，请稍后重试',
        { originalError: error.message },
      );
    }
  }

  async getSharedTradeByShareId(shareId: string) {
    try {
      const result = await this.db.query({
        TableName: this.tableName,
        IndexName: this.shareIdIndexName,
        KeyConditionExpression: '#shareId = :shareId',
        FilterExpression: '#isShareable = :shareable',
        ExpressionAttributeNames: {
          '#shareId': 'shareId',
          '#isShareable': 'isShareable',
        },
        ExpressionAttributeValues: {
          ':shareId': shareId,
          ':shareable': true,
        },
        Limit: 1,
      });

      const item = (result.Items || [])[0] as Trade | undefined;
      const isShareable = item?.isShareable === true;
      if (!item || !isShareable) {
        throw new ResourceNotFoundException(
          `分享交易不存在: shareId=${shareId}`,
          ERROR_CODES.TRADE_NOT_FOUND,
          '分享交易不存在或未开启分享',
        );
      }

      return {
        success: true,
        data: item,
      };
    } catch (error) {
      console.error('[TradeService] getSharedTradeByShareId error:', error);
      if (error instanceof ResourceNotFoundException) {
        throw error;
      }
      throw new DynamoDBException(
        `分享交易获取失败: ${error.message}`,
        ERROR_CODES.DYNAMODB_OPERATION_FAILED,
        '分享交易获取失败，请稍后重试',
        { originalError: error.message },
      );
    }
  }

  async updateTrade(
    userId: string,
    transactionId: string,
    dto: UpdateTradeDto,
  ) {
    try {
      const oldRes = await this.getTrade(userId, transactionId);
      if (!oldRes.success) {
        throw new ResourceNotFoundException(
          `交易记录不存在: userId=${userId}, transactionId=${transactionId}`,
          ERROR_CODES.TRADE_NOT_FOUND,
          '交易记录不存在',
        );
      }
      // 确保从 dto 更新的属性类型正确
      const existingTrade = oldRes.data as Trade;

      // 直接将 dto 中的所有属性复制到 updatedTradeData 中
      // 由于我们已经更新了 DTO 和实体，字段名称现在是一致的
      const normalizedProfitLossPercentage =
        dto.profitLossPercentage === undefined
          ? undefined
          : dto.profitLossPercentage === null
            ? 0
            : dto.profitLossPercentage;

      if (
        normalizedProfitLossPercentage !== undefined &&
        (typeof normalizedProfitLossPercentage !== 'number' ||
          !Number.isFinite(normalizedProfitLossPercentage))
      ) {
        throw new ValidationException(
          `profitLossPercentage must be a finite number, got: ${dto.profitLossPercentage}`,
          ERROR_CODES.VALIDATION_INVALID_VALUE,
          '盈亏百分比必须是数字，否则保存失败',
          { value: dto.profitLossPercentage },
        );
      }

      const updatedTradeData: Partial<Trade> = {
        ...dto,
        analysisTime: dto.analysisTime, // 行情分析时间
        ...(normalizedProfitLossPercentage !== undefined
          ? { profitLossPercentage: normalizedProfitLossPercentage }
          : {}),
      };

      const merged: Trade = {
        ...existingTrade,
        ...updatedTradeData, // updatedTradeData 现在包含了正确映射的属性
        updatedAt: new Date().toISOString(),
      };

      merged.exitQualityTag = this.ensureExitQualityTagForExited({
        status: merged.status,
        exitQualityTag: merged.exitQualityTag,
        tradeTags: merged.tradeTags,
      }) as any;

      const updated: Trade = this.sanitizeTradeImageUrlsForStorage({
        ...merged,
        ...this.computeRiskMetrics(merged),
      });
      await this.db.put({
        TableName: this.tableName,
        Item: updated,
      });

      return {
        success: true,
        message: '更新成功',
        data: updated,
      };
    } catch (error) {
      console.error('[TradeService] updateTrade error:', error);
      if (error instanceof ResourceNotFoundException) {
        throw error;
      }
      throw new DynamoDBException(
        `交易更新失败: ${error.message}`,
        ERROR_CODES.DYNAMODB_OPERATION_FAILED,
        '交易更新失败，请稍后重试',
        { originalError: error.message },
      );
    }
  }

  async deleteTrade(userId: string, transactionId: string) {
    try {
      // 存在性和权限校验
      const oldRes = await this.getTrade(userId, transactionId);
      if (!oldRes.success) {
        throw new AuthorizationException(
          `删除前检查失败: userId=${userId}, transactionId=${transactionId}`,
          ERROR_CODES.TRADE_ACCESS_DENIED,
          '您没有权限访问此交易记录',
        );
      }

      await this.db.delete({
        TableName: this.tableName,
        Key: { userId, transactionId },
      });
      return {
        success: true,
        message: '删除成功',
      };
    } catch (error) {
      console.error('[TradeService] deleteTrade error:', error);
      if (error instanceof AuthorizationException) {
        throw error;
      }
      throw new DynamoDBException(
        `交易删除失败: ${error.message}`,
        ERROR_CODES.DYNAMODB_OPERATION_FAILED,
        '交易删除失败，请稍后重试',
        { originalError: error.message },
      );
    }
  }

  /**
   * 根据用户ID和过滤条件查询交易记录
   * @param userId 用户ID
   * @param page 页码
   * @param pageSize 每页大小
   * @param filters 过滤条件
   */
  /**
   * 复制交易记录
   * @param userId 用户ID
   * @param transactionId 要复制的交易ID
   * @returns 复制后的新交易记录
   */
  async copyTrade(userId: string, transactionId: string) {
    try {
      // 获取原始交易记录
      const originalTradeRes = await this.getTrade(userId, transactionId);
      if (!originalTradeRes.success) {
        throw new ResourceNotFoundException(
          `复制的交易记录不存在: userId=${userId}, transactionId=${transactionId}`,
          ERROR_CODES.TRADE_NOT_FOUND,
          '交易记录不存在',
        );
      }

      const originalTrade = originalTradeRes.data as Trade;
      const now = new Date().toISOString();
      const newTransactionId = uuidv4();

      // 创建新的交易记录，复制原始交易的所有数据
      const newTrade: Trade = this.sanitizeTradeImageUrlsForStorage({
        ...originalTrade,
        transactionId: newTransactionId, // 新的交易ID
        analysisExpired: false, // 将分析已过期字段设置为未过期
        isShareable: false,
        createdAt: now,
        updatedAt: now,
      });

      if (newTrade.shareId) {
        delete newTrade.shareId;
      }

      // 保存新的交易记录
      await this.db.put({
        TableName: this.tableName,
        Item: newTrade,
      });

      return {
        success: true,
        message: '复制成功',
        data: newTrade,
      };
    } catch (error) {
      console.error('[TradeService] copyTrade error:', error);
      if (error instanceof ResourceNotFoundException) {
        throw error;
      }
      throw new DynamoDBException(
        `交易复制失败: ${error.message}`,
        ERROR_CODES.DYNAMODB_OPERATION_FAILED,
        '交易复制失败，请稍后重试',
        { originalError: error.message },
      );
    }
  }

  async findByUserIdWithFilters(
    userId: string,
    page = 1,
    pageSize = 20,
    filters: {
      marketStructure?: string;
      entryDirection?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
      tradeResult?: string;
    } = {},
  ) {
    try {
      // 构建过滤表达式
      let filterExpression = '';
      const expressionAttributeValues: Record<string, any> = {
        ':userId': userId,
      };
      const expressionAttributeNames: Record<string, string> = {};

      // 添加市场结构过滤条件
      if (filters.marketStructure && filters.marketStructure !== 'all') {
        filterExpression += filterExpression ? ' AND ' : '';
        filterExpression += '#marketStructure = :marketStructure';
        expressionAttributeValues[':marketStructure'] = filters.marketStructure;
        expressionAttributeNames['#marketStructure'] = 'marketStructure';
      }

      // 添加入场方向过滤条件
      if (filters.entryDirection && filters.entryDirection !== 'all') {
        filterExpression += filterExpression ? ' AND ' : '';
        filterExpression += '#entryDirection = :entryDirection';
        expressionAttributeValues[':entryDirection'] = filters.entryDirection;
        expressionAttributeNames['#entryDirection'] = 'entryDirection';
      }

      // 添加交易状态过滤条件
      if (filters.status && filters.status !== 'all') {
        filterExpression += filterExpression ? ' AND ' : '';
        filterExpression += '#status = :status';
        expressionAttributeValues[':status'] = filters.status;
        expressionAttributeNames['#status'] = 'status';
      }

      // 添加交易结果过滤条件
      if (filters.tradeResult && filters.tradeResult !== 'all') {
        filterExpression += filterExpression ? ' AND ' : '';
        filterExpression += '#tradeResult = :tradeResult';
        expressionAttributeValues[':tradeResult'] = filters.tradeResult;
        expressionAttributeNames['#tradeResult'] = 'tradeResult';
      }

      // 添加日期范围过滤条件 (使用 createdAt 字段)
      if (filters.dateFrom) {
        filterExpression += filterExpression ? ' AND ' : '';
        filterExpression += '#createdAt >= :dateFrom';
        expressionAttributeValues[':dateFrom'] = filters.dateFrom;
        expressionAttributeNames['#createdAt'] = 'createdAt';
      }

      if (filters.dateTo) {
        filterExpression += filterExpression ? ' AND ' : '';
        filterExpression += '#createdAt <= :dateTo';
        expressionAttributeValues[':dateTo'] =
          filters.dateTo + 'T23:59:59.999Z'; // 设置为当天结束时间
        if (!expressionAttributeNames['#createdAt']) {
          expressionAttributeNames['#createdAt'] = 'createdAt';
        }
      }

      // 先获取总数
      const countParams: any = {
        TableName: this.tableName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: expressionAttributeValues,
        Select: 'COUNT',
      };

      if (filterExpression) {
        countParams.FilterExpression = filterExpression;
        countParams.ExpressionAttributeNames = expressionAttributeNames;
      }

      const countResult = await this.db.query(countParams);
      const total = countResult.Count || 0;
      const totalPages = Math.ceil(total / pageSize);

      if (total === 0) {
        return {
          success: true,
          data: {
            items: [],
            total,
            page,
            pageSize,
            totalPages: 0,
          },
        };
      }

      // 查询带过滤条件的数据
      const queryParams: any = {
        TableName: this.tableName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: expressionAttributeValues,
        Limit: pageSize,
        ScanIndexForward: false, // 按时间倒序排序
      };

      if (filterExpression) {
        queryParams.FilterExpression = filterExpression;
        queryParams.ExpressionAttributeNames = expressionAttributeNames;
      }

      const result = await this.db.query(queryParams);
      const mappedItems = result.Items as Trade[];

      return {
        success: true,
        data: {
          items: mappedItems,
          total,
          page,
          pageSize,
          totalPages,
        },
      };
    } catch (error) {
      console.error(
        '[TradeService] findByUserIdWithFilters error:',
        JSON.stringify(error),
      );
      throw new DynamoDBException(
        `带过滤器查询失败: ${error.message}`,
        ERROR_CODES.DYNAMODB_OPERATION_FAILED,
        '交易列表获取失败，请稍后重试',
        { originalError: error.message },
      );
    }
  }
}
