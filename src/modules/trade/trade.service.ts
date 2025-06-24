import { Injectable, Logger } from '@nestjs/common';
import { CreateTradeDto } from './dto/create-trade.dto';
import { UpdateTradeDto } from './dto/update-trade.dto';
import { Trade } from './entities/trade.entity';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { ConfigService } from '../common/config.service';
import { TradeQueryDto } from './dto/trade-query.dto';
import { TradeHistoryRAGService } from '../rag/trade-history-rag.service';
import { getCurrentRAGConfig, validateRAGConfig, RAGEvaluationConfig } from './rag-evaluation.config';
import {
  DynamoDBException,
  AuthorizationException,
  ResourceNotFoundException,
} from '../../base/exceptions/custom.exceptions';
import { ERROR_CODES } from '../../base/constants/error-codes';

@Injectable()
export class TradeService {
  private readonly logger = new Logger(TradeService.name);
  private readonly db: DynamoDBDocument;
  private readonly tableName: string;
  private readonly ragConfig: RAGEvaluationConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly tradeHistoryRAGService: TradeHistoryRAGService,
  ) {
    const tableName = this.configService.getOrThrow('TRANSACTIONS_TABLE_NAME');
    const region = this.configService.getOrThrow('AWS_REGION');
    console.log('[TradeService] 使用 DynamoDB 表:', tableName); // 打印环境变量的值
    this.tableName = tableName;

    // 初始化RAG评估配置
    this.ragConfig = getCurrentRAGConfig();
    if (!validateRAGConfig(this.ragConfig)) {
      this.logger.warn('RAG评估配置验证失败，使用默认配置');
    }
    this.logger.log(`RAG评估配置已加载，阈值: ${this.ragConfig.threshold}分`);
    // 配置 DynamoDBDocument，添加转换选项
    this.db = DynamoDBDocument.from(new DynamoDB({ region }), {
      marshallOptions: {
        convertClassInstanceToMap: true,
      },
    });
    console.log('[TradeService] db:', this.db); // 打印 db 对象
  }

  async createTrade(userId: string, dto: CreateTradeDto) {
    const now = new Date().toISOString();
    const transactionId = uuidv4();
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
    const newTrade: Trade = {
      transactionId,
      userId,
      tradeType: dto.tradeType,
      tradeSubject: dto.tradeSubject,
      grade: dto.grade,
      analysisTime: dto.analysisTime, // 行情分析时间
      // ===== 交易状态 =====
      status: dto.status,
      // ===== 入场前分析 =====
      volumeProfileImages: dto.volumeProfileImages,
      poc: dto.poc,
      val: dto.val,
      vah: dto.vah,
      keyPriceLevels: dto.keyPriceLevels,
      marketStructure: dto.marketStructure,
      marketStructureAnalysis: dto.marketStructureAnalysis,
      expectedPathImages: dto.expectedPathImages,
      expectedPathAnalysis: dto.expectedPathAnalysis,
      entryPlanA: dto.entryPlanA,
      entryPlanB: dto.entryPlanB,
      entryPlanC: dto.entryPlanC,
      // ===== 入场记录 =====
      entryPrice: dto.entryPrice,
      entryTime: dto.entryTime,
      entryDirection: dto.entryDirection,
      stopLoss: dto.stopLoss,
      takeProfit: dto.takeProfit,
      mentalityNotes: dto.mentalityNotes,
      // ===== 离场后分析 =====
      exitPrice: dto.exitPrice,
      exitTime: dto.exitTime,
      tradeResult: dto.tradeResult,
      followedPlan: dto.followedPlan,
      actualPathImages: dto.actualPathImages,
      actualPathAnalysis: dto.actualPathAnalysis,
      remarks: dto.remarks,
      lessonsLearned: dto.lessonsLearned,
      analysisImages: dto.analysisImages,
      // 基础计算字段
      profitLossPercentage: dto.profitLossPercentage,
      riskRewardRatio: dto.riskRewardRatio,
      createdAt: now,
      updatedAt: now,
    };
    console.log('[TradeService] createTrade userId:', userId);
    try {
      await this.db.put({
        TableName: this.tableName,
        Item: newTrade,
      });

      // 检查是否需要添加到交易历史RAG库
      await this.checkAndAddToRAGHistory(newTrade);

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
        (t) => t.tradeResult === '盈利',
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
      // 先获取总数
      const countResult = await this.db.query({
        TableName: this.tableName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
        Select: 'COUNT',
      });

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

      // 这里只做简单分页，如果需要准确游标分页，建议基于 LastEvaluatedKey 实现
      const result = await this.db.query({
        TableName: this.tableName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
        Limit: pageSize,
        ScanIndexForward: false,
      });

      // 直接返回结果，不需要映射字段名称
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
    let {
      page = 1,
      pageSize,
      limit,
      type,
      grade,
      marketStructure,
      entryDirection,
      tradeStatus,
      tradeResult,
      dateTimeRange,
      tradeType,
      dateFrom,
      dateTo,
    } = dto;
    pageSize = limit ?? pageSize ?? 20;

    try {
      const result = await this.db.query({
        TableName: this.tableName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
        // 设置 ScanIndexForward 为 false，使结果按创建时间降序排列（从最新到最旧）
        ScanIndexForward: false,
      });

      let items = (result.Items || []) as Trade[];

      // 确保按照 createdAt 降序排序
      items.sort((a, b) => {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });

      // u4f7fu7528 tradeType u53c2u6570u8fdbu884cu8fc7u6ee4uff0cu4f18u5148u7ea7u9ad8u4e8e type u53c2u6570
      if (tradeType && tradeType !== 'all')
        items = items.filter((t) => t.tradeType === tradeType);
      else if (type && type !== 'all')
        items = items.filter((t) => t.tradeType === type);
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
      // 处理日期范围查询 - 支持两种方式：dateTimeRange 对象或 dateFrom/dateTo 参数
      let fromDate = '';
      let toDate = '';

      // 处理 dateTimeRange 对象
      if (dateTimeRange && (dateTimeRange.from || dateTimeRange.to)) {
        if (dateTimeRange.from) {
          try {
            fromDate = new Date(dateTimeRange.from).toISOString().split('T')[0];
          } catch (e) {
            console.error('Invalid dateTimeRange.from:', dateTimeRange.from);
          }
        }

        if (dateTimeRange.to) {
          try {
            const endDate = new Date(dateTimeRange.to);
            endDate.setHours(23, 59, 59, 999);
            toDate = endDate.toISOString();
          } catch (e) {
            console.error('Invalid dateTimeRange.to:', dateTimeRange.to);
          }
        }
      }

      // 处理直接传入的 dateFrom/dateTo 参数（优先级高于 dateTimeRange）
      if (dateFrom) {
        try {
          fromDate = new Date(dateFrom).toISOString().split('T')[0];
        } catch (e) {
          console.error('Invalid dateFrom:', dateFrom);
        }
      }

      if (dateTo) {
        try {
          const endDate = new Date(dateTo);
          endDate.setHours(23, 59, 59, 999);
          toDate = endDate.toISOString();
        } catch (e) {
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
      const updatedTradeData: Partial<Trade> = {
        ...dto,
        analysisTime: dto.analysisTime, // 行情分析时间
      };

      const updated: Trade = {
        ...existingTrade,
        ...updatedTradeData, // updatedTradeData 现在包含了正确映射的属性
        updatedAt: new Date().toISOString(),
      };
      await this.db.put({
        TableName: this.tableName,
        Item: updated,
      });

      // 检查是否需要添加到交易历史RAG库
      await this.checkAndAddToRAGHistory(updated);

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

      // 从向量数据库删除交易历史
      try {
        await this.tradeHistoryRAGService.removeTradeFromHistory(transactionId);
        this.logger.log(`Removed trade ${transactionId} from RAG history`);
      } catch (error) {
        this.logger.warn(
          `Failed to remove trade ${transactionId} from RAG history: ${error.message}`,
        );
        // 不阻止删除操作，只记录警告
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
      const newTrade: Trade = {
        ...originalTrade,
        transactionId: newTransactionId, // 新的交易ID
        analysisExpired: false, // 将分析已过期字段设置为未过期
        createdAt: now,
        updatedAt: now,
      };

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

  /**
   * 检查交易是否需要添加到RAG历史库
   * 使用多维度评估系统判断交易记录的价值
   */
  private async checkAndAddToRAGHistory(trade: Trade): Promise<void> {
    try {
      const shouldAddToRAG = this.evaluateTradeValueForRAG(trade);

      if (shouldAddToRAG.shouldAdd) {
        this.logger.log(
          `Adding trade ${trade.transactionId} to RAG history - ${shouldAddToRAG.reason}`,
        );
        await this.tradeHistoryRAGService.addTradeToHistory(trade);
        this.logger.log(
          `Successfully added trade ${trade.transactionId} to RAG history`,
        );
      } else {
        this.logger.debug(
          `Skipping trade ${trade.transactionId} for RAG - ${shouldAddToRAG.reason}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to add trade ${trade.transactionId} to RAG history: ${error.message}`,
        error,
      );
      // 不抛出异常，避免影响主要的交易操作
    }
  }

  /**
   * 评估交易记录是否有价值添加到RAG系统
   * 使用多维度评分系统进行综合判断
   */
  private evaluateTradeValueForRAG(trade: Trade): { shouldAdd: boolean; reason: string; score: number } {
    let score = 0;
    const reasons: string[] = [];

    // 1. 基础完整性检查 (必要条件)
    if (!this.isTradeDataComplete(trade)) {
      return {
        shouldAdd: false,
        reason: '交易数据不完整，缺少关键信息',
        score: 0
      };
    }

    // 2. 交易状态评估 (权重: 20分)
    const statusValue = this.assessTradeStatus(trade);
    score += statusValue.score;
    if (statusValue.reasons.length > 0) {
      reasons.push(...statusValue.reasons);
    }

    // 3. 学习价值评估 (权重: 25分)
    const learningValue = this.assessLearningValue(trade);
    score += learningValue.score;
    if (learningValue.reasons.length > 0) {
      reasons.push(...learningValue.reasons);
    }

    // 4. 交易重要性评估 (权重: 15分)
    const importanceValue = this.assessTradeImportance(trade);
    score += importanceValue.score;
    if (importanceValue.reasons.length > 0) {
      reasons.push(...importanceValue.reasons);
    }

    // 5. 分析质量评估 (权重: 20分)
    const analysisQuality = this.assessAnalysisQuality(trade);
    score += analysisQuality.score;
    if (analysisQuality.reasons.length > 0) {
      reasons.push(...analysisQuality.reasons);
    }

    // 6. 交易结果多样性评估 (权重: 10分)
    const diversityValue = this.assessResultDiversity(trade);
    score += diversityValue.score;
    if (diversityValue.reasons.length > 0) {
      reasons.push(...diversityValue.reasons);
    }

    // 判断阈值：使用配置文件中的阈值
    const threshold = this.ragConfig.threshold;
    const shouldAdd = score >= threshold;

    return {
      shouldAdd,
      reason: shouldAdd
        ? `综合评分${score}/100，符合条件: ${reasons.join(', ')}`
        : `综合评分${score}/100，未达到阈值${threshold}分`,
      score
    };
  }

  /**
   * 检查交易数据完整性
   */
  private isTradeDataComplete(trade: Trade): boolean {
    // 基础必要字段检查
    const requiredStringFields = [
      trade.tradeSubject,
      trade.tradeType,
      trade.analysisTime,
      trade.marketStructure,
      trade.marketStructureAnalysis
    ];

    // 检查字符串字段
    const stringFieldsValid = requiredStringFields.every(
      field => field !== undefined && field !== null && field !== ''
    );

    if (!stringFieldsValid) {
      return false;
    }

    // 根据交易状态检查相应字段
    if (trade.status === '已离场') {
      // 完整交易：需要入场和离场数据
      const requiredNumberFields = [trade.entryPrice, trade.exitPrice];
      const numberFieldsValid = requiredNumberFields.every(
        field => field !== undefined && field !== null && !isNaN(field)
      );

      const enumFieldsValid =
        trade.entryDirection !== undefined &&
        trade.entryDirection !== null &&
        trade.tradeResult !== undefined &&
        trade.tradeResult !== null;

      return numberFieldsValid && enumFieldsValid;
    } else if (trade.status === '已入场') {
      // 已入场：需要入场数据
      const entryFieldsValid =
        trade.entryPrice !== undefined &&
        trade.entryPrice !== null &&
        !isNaN(trade.entryPrice) &&
        trade.entryDirection !== undefined &&
        trade.entryDirection !== null;

      return entryFieldsValid;
    } else if (trade.status === '已分析') {
      // 纯分析：基础字段已检查，无需额外要求
      return true;
    }

    return true;
  }

  /**
   * 评估交易的学习价值
   */
  private assessLearningValue(trade: Trade): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    // 经验总结存在且有实质内容
    if (trade.lessonsLearned && trade.lessonsLearned.trim().length > this.ragConfig.textRequirements.detailedLessonsLearned) {
      score += this.ragConfig.learningScores.detailedLessons;
      reasons.push('包含详细经验总结');
    } else if (trade.lessonsLearned && trade.lessonsLearned.trim().length > 0) {
      score += this.ragConfig.learningScores.basicLessons;
      reasons.push('包含简单经验总结');
    }

    // 心态记录存在
    if (trade.mentalityNotes && trade.mentalityNotes.trim().length > this.ragConfig.textRequirements.basicMentalityNotes) {
      score += this.ragConfig.learningScores.mentalityNotes;
      reasons.push('包含心态记录');
    }

    // 实际路径分析存在
    if (trade.actualPathAnalysis && trade.actualPathAnalysis.trim().length > this.ragConfig.textRequirements.detailedPathAnalysis) {
      score += this.ragConfig.learningScores.pathAnalysis;
      reasons.push('包含实际路径分析');
    }

    return { score, reasons };
  }

  /**
   * 评估交易重要性
   */
  private assessTradeImportance(trade: Trade): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    // 交易分级评估
    if (trade.grade === '高') {
      score += this.ragConfig.importanceScores.gradeHigh;
      reasons.push('高重要性交易');
    } else if (trade.grade === '中') {
      score += this.ragConfig.importanceScores.gradeMedium;
      reasons.push('中等重要性交易');
    } else if (trade.grade === '低') {
      score += this.ragConfig.importanceScores.gradeLow;
      reasons.push('低重要性交易');
    }

    // 真实交易vs模拟交易
    if (trade.tradeType === '真实交易') {
      score += this.ragConfig.importanceScores.realTrade;
      reasons.push('真实交易记录');
    } else {
      score += this.ragConfig.importanceScores.simulationTrade;
      reasons.push('模拟交易记录');
    }

    return { score, reasons };
  }

  /**
   * 评估分析质量
   */
  private assessAnalysisQuality(trade: Trade): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    // 市场结构分析质量
    if (trade.marketStructureAnalysis && trade.marketStructureAnalysis.trim().length > this.ragConfig.textRequirements.detailedMarketAnalysis) {
      score += this.ragConfig.qualityScores.detailedMarketAnalysis;
      reasons.push('详细市场结构分析');
    } else if (trade.marketStructureAnalysis && trade.marketStructureAnalysis.trim().length > this.ragConfig.textRequirements.basicMarketAnalysis) {
      score += this.ragConfig.qualityScores.basicMarketAnalysis;
      reasons.push('基础市场结构分析');
    }

    // 预期路径分析存在
    if (trade.expectedPathAnalysis && trade.expectedPathAnalysis.trim().length > this.ragConfig.textRequirements.basicPathAnalysis) {
      score += this.ragConfig.qualityScores.expectedPathAnalysis;
      reasons.push('包含预期路径分析');
    }

    // 入场计划完整性
    let planCount = 0;
    if (trade.entryPlanA?.entryReason) planCount++;
    if (trade.entryPlanB?.entryReason) planCount++;
    if (trade.entryPlanC?.entryReason) planCount++;

    if (planCount >= 2) {
      score += this.ragConfig.qualityScores.multiplePlans;
      reasons.push('多套入场计划');
    } else if (planCount === 1) {
      score += this.ragConfig.qualityScores.singlePlan;
      reasons.push('单套入场计划');
    }

    // 图片资源丰富度
    const imageCount = (trade.volumeProfileImages?.length || 0) +
                      (trade.expectedPathImages?.length || 0) +
                      (trade.actualPathImages?.length || 0) +
                      (trade.analysisImages?.length || 0);

    if (imageCount >= this.ragConfig.imageRequirements.richImages) {
      score += this.ragConfig.qualityScores.richImages;
      reasons.push('丰富的图片资源');
    } else if (imageCount >= this.ragConfig.imageRequirements.basicImages) {
      score += this.ragConfig.qualityScores.basicImages;
      reasons.push('基础图片资源');
    }

    return { score, reasons };
  }

  /**
   * 评估交易结果多样性价值
   */
  private assessResultDiversity(trade: Trade): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    // 亏损交易的学习价值更高
    if (trade.tradeResult === '亏损') {
      score += this.ragConfig.diversityScores.loss;
      reasons.push('亏损交易具有高学习价值');
    } else if (trade.tradeResult === '盈利') {
      score += this.ragConfig.diversityScores.profit;
      reasons.push('盈利交易经验');
    } else if (trade.tradeResult === '保本') {
      score += this.ragConfig.diversityScores.breakeven;
      reasons.push('保本交易经验');
    }

    return { score, reasons };
  }

  /**
   * 评估交易状态价值
   */
  private assessTradeStatus(trade: Trade): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    if (trade.status === '已离场') {
      // 完整的交易流程，包含入场和离场
      score += this.ragConfig.statusScores.exited;
      reasons.push('完整交易流程');
    } else if (trade.status === '已分析') {
      // 纯行情分析，没有实际交易但有分析价值
      score += this.ragConfig.statusScores.analyzed;
      reasons.push('纯行情分析');

      // 对于纯分析，如果有预期路径分析或经验总结，额外加分
      if (trade.expectedPathAnalysis || trade.lessonsLearned || trade.remarks) {
        score += this.ragConfig.statusScores.analyzedWithDepth;
        reasons.push('包含深度分析或总结');
      }
    } else if (trade.status === '已入场') {
      // 已入场但未离场，价值相对较低
      score += this.ragConfig.statusScores.entered;
      reasons.push('交易进行中');
    }

    return { score, reasons };
  }
}
