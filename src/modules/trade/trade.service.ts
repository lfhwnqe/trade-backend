import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateTradeDto } from './dto/create-trade.dto';
import { UpdateTradeDto } from './dto/update-trade.dto';
import { Trade } from './entities/trade.entity';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { ConfigService } from 'src/modules/common/config.service';

@Injectable()
export class TradeService {
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
     * @param signalType - 信号类型。
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
      throw new Error('交易创建失败');
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
      throw new Error('交易列表获取失败');
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
        throw new ForbiddenException('没有权限访问此交易');
      }
      return {
        success: true,
        data: result.Item as Trade,
      };
    } catch (error) {
      console.error('[TradeService] getTrade error:', error);
      throw new Error('交易记录获取失败');
    }
  }

  async updateTrade(
    userId: string,
    transactionId: string,
    dto: UpdateTradeDto,
  ) {
    try {
      const oldRes = await this.getTrade(userId, transactionId);
      if (!oldRes.success) throw new NotFoundException('交易记录不存在');
      // 确保从 dto 更新的属性类型正确
      const existingTrade = oldRes.data as Trade;
      
      // 直接将 dto 中的所有属性复制到 updatedTradeData 中
      // 由于我们已经更新了 DTO 和实体，字段名称现在是一致的
      const updatedTradeData: Partial<Trade> = { ...dto };

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
      throw new Error('交易更新失败');
    }
  }

  async deleteTrade(userId: string, transactionId: string) {
    try {
      // 存在性和权限校验
      const oldRes = await this.getTrade(userId, transactionId);
      if (!oldRes.success) throw new NotFoundException('交易记录不存在');
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
      throw new Error('交易删除失败');
    }
  }
}
