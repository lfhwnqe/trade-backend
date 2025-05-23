import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateTradeDto, EntryDirection } from './dto/create-trade.dto';
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
    // this.db = DynamoDBDocument.from(new DynamoDB());
    console.log('[TradeService] db:', this.db); // 打印 db 对象
    // 显式指定区域
    this.db = DynamoDBDocument.from(new DynamoDB({ region }));
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
      dateTimeRange: dto.dateTimeRange,
      marketStructure: dto.marketStructure,
      vah: dto.vah,
      val: dto.val,
      poc: dto.poc,
      entryDirection: dto.entryDirection,
      entryPrice: dto.entry, // DTO中的entry对应实体的entryPrice
      stopLossPrice: dto.stopLoss, // DTO中的stopLoss对应实体的stopLossPrice
      targetPrice: dto.target, // DTO中的target对应实体的targetPrice
      exitPrice: dto.exit, // DTO中的exit对应实体的exitPrice
      volumeProfileImage: dto.volumeProfileImage,
      hypothesisPaths: dto.hypothesisPaths,
      actualPath: dto.actualPath,
      profitLoss: dto.profitLoss,
      rr: dto.rr,
      analysisError: dto.analysisResult, // DTO中的analysisResult对应实体的analysisError
      executionMindsetScore: dto.executionMindsetScore,
      improvement: dto.improvement,
      createdAt: now,
      updatedAt: now,
    };

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

      return {
        success: true,
        data: {
          items: (result.Items as Trade[]) || [],
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
      const updatedTradeData: Partial<Trade> = {};

      // 创建 dto 的一个可修改副本，以便我们可以安全地删除属性
      const dtoCopy = { ...dto };

      if (dtoCopy.entry !== undefined) {
        updatedTradeData.entryPrice = dtoCopy.entry;
        delete dtoCopy.entry; // 从副本中删除，避免后续被错误地直接拷贝
      }
      if (dtoCopy.stopLoss !== undefined) {
        updatedTradeData.stopLossPrice = dtoCopy.stopLoss;
        delete dtoCopy.stopLoss;
      }
      if (dtoCopy.target !== undefined) {
        updatedTradeData.targetPrice = dtoCopy.target;
        delete dtoCopy.target;
      }
      if (dtoCopy.exit !== undefined) {
        updatedTradeData.exitPrice = dtoCopy.exit;
        delete dtoCopy.exit;
      }

      // 拷贝剩余的、名称一致的属性
      for (const key in dtoCopy) {
        if (Object.prototype.hasOwnProperty.call(dtoCopy, key)) {
          if (
            key === 'entryDirection' &&
            dtoCopy.entryDirection !== undefined
          ) {
            updatedTradeData.entryDirection = dtoCopy.entryDirection;
          } else if (
            key === 'analysisResult' &&
            dtoCopy.analysisResult !== undefined
          ) {
            updatedTradeData.analysisError = dtoCopy.analysisResult;
          } else {
            updatedTradeData[key] = dtoCopy[key];
          }
        }
      }

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
