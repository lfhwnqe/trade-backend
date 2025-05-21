import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateTradeDto } from './dto/create-trade.dto';
import { UpdateTradeDto } from './dto/update-trade.dto';
import { Trade } from './entities/trade.entity';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDB, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { ConfigService } from 'src/common/config.service';

@Injectable()
export class TradeService {
  private readonly db: DynamoDBDocument;
  private readonly tableName: string;

  constructor(private readonly configService: ConfigService) {
    const tableName = this.configService.getOrThrow('TRANSACTIONS_TABLE_NAME');
    console.log('[TradeService] 使用 DynamoDB 表:', tableName);
    this.tableName = tableName;
    this.db = DynamoDBDocument.from(new DynamoDB());
    // this.db = DynamoDBDocument.from(new DynamoDB(options));
  }

  async createTrade(userId: string, dto: CreateTradeDto) {
    const now = new Date().toISOString();
    const transactionId = uuidv4();
    const newTrade: Trade = {
      transactionId,
      userId,
      ...dto,
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
      const updated: Trade = {
        ...(oldRes.data as Trade),
        ...dto,
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
