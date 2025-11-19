import { Injectable, Logger } from '@nestjs/common';
import { CreateTradeDto, TradeResult } from './dto/create-trade.dto';
import { UpdateTradeDto } from './dto/update-trade.dto';
import { Trade } from './entities/trade.entity';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { ConfigService } from '../common/config.service';
import { TradeQueryDto } from './dto/trade-query.dto';
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

  /**
   * 分页获取交易总结（lessonsLearned）列表
   * @param userId 用户ID
   * @param page 页码，默认为1
   * @param pageSize 每页数量，默认为20，最大100
   */
  async getTradeSummaries(userId: string, page = 1, pageSize = 20) {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(Math.max(pageSize, 1), 100);

    try {
      const result = await this.db.query({
        TableName: this.tableName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
        ScanIndexForward: false,
      });

      const allTrades = (result.Items || []) as Trade[];
      console.log('🌹allTrades：', allTrades);

      // 仅保留填写了总结信息的交易，并保持最新在前
      const summaryItems = allTrades.filter(
        (trade) =>
          typeof trade.lessonsLearned === 'string' &&
          trade.lessonsLearned.trim().length > 0,
      );

      const total = summaryItems.length;
      if (total === 0) {
        return {
          success: true,
          data: {
            items: [],
            total,
            page: safePage,
            pageSize: safePageSize,
            totalPages: 0,
          },
        };
      }

      const totalPages = Math.ceil(total / safePageSize);
      const start = (safePage - 1) * safePageSize;
      const pagedItems = summaryItems
        .slice(start, start + safePageSize)
        .map((trade) => ({
          transactionId: trade.transactionId,
          lessonsLearned: trade.lessonsLearned,
          tradeSubject: trade.tradeSubject,
          status: trade.status,
          tradeResult: trade.tradeResult,
          createdAt: trade.createdAt,
          updatedAt: trade.updatedAt,
        }));

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
      console.error('[TradeService] getTradeSummaries error:', error);
      throw new DynamoDBException(
        `交易总结获取失败: ${error.message}`,
        ERROR_CODES.DYNAMODB_OPERATION_FAILED,
        '交易总结获取失败，请稍后重试',
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
}
