import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateSimulationTrainDto } from './dto/create-simulation-train.dto';
import { UpdateSimulationTrainDto } from './dto/update-simulation-train.dto'
import { SimulationTrain } from './entities/simulation-train.entity';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { ConfigService } from 'src/modules/common/config.service';

@Injectable()
export class SimulationTrainService {
  private readonly db: DynamoDBDocument;
  private readonly tableName: string;

  constructor(private readonly configService: ConfigService) {
    // 推荐用 SIMULATION_TRAIN_TABLE_NAME 环境变量区分新表
    const tableName = this.configService.getOrThrow('SIMULATION_TRAIN_TABLE_NAME');
    const region = this.configService.getOrThrow('AWS_REGION');
    console.log('[SimulationTrainService] 使用 DynamoDB 表:', tableName);
    this.tableName = tableName;
    this.db = DynamoDBDocument.from(new DynamoDB({ region }), {
      marshallOptions: {
        convertClassInstanceToMap: true,
      },
    });
    console.log('[SimulationTrainService] db:', this.db);
  }

  async createSimulationTrain(userId: string, dto: CreateSimulationTrainDto) {
    const now = new Date().toISOString();
    const simulationTrainId = uuidv4();

    const newSimulation: SimulationTrain = {
      simulationTrainId,
      userId,
      analysisTime: dto.analysisTime,
      status: dto.status,
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
      entryPrice: dto.entryPrice,
      entryTime: dto.entryTime,
      entryDirection: dto.entryDirection,
      stopLoss: dto.stopLoss,
      takeProfit: dto.takeProfit,
      mentalityNotes: dto.mentalityNotes,
      exitPrice: dto.exitPrice,
      exitTime: dto.exitTime,
      tradeResult: dto.tradeResult,
      followedPlan: dto.followedPlan,
      actualPathImages: dto.actualPathImages,
      actualPathAnalysis: dto.actualPathAnalysis,
      remarks: dto.remarks,
      lessonsLearned: dto.lessonsLearned,
      analysisImages: dto.analysisImages,
      profitLossPercentage: dto.profitLossPercentage,
      riskRewardRatio: dto.riskRewardRatio,
      createdAt: now,
      updatedAt: now,
    };
    console.log('[SimulationTrainService] createSimulationTrain userId:', userId);
    try {
      await this.db.put({
        TableName: this.tableName,
        Item: newSimulation,
      });
      return {
        success: true,
        message: '创建成功',
        data: newSimulation,
      };
    } catch (error) {
      console.error('[SimulationTrainService] createSimulationTrain error:', error);
      throw new Error('模拟交易创建失败');
    }
  }

  async getThisMonthStats(userId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthStartStr = monthStart.toISOString();
    const monthEndStr = monthEnd.toISOString();

    try {
      const result = await this.db.query({
        TableName: this.tableName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
      });
      const items = (result.Items || []) as SimulationTrain[];
      const monthTrains = items.filter(
        t =>
          t.createdAt >= monthStartStr &&
          t.createdAt < monthEndStr &&
          t.status === '已离场'
      );
      const thisMonthClosedSimulationCount = monthTrains.length;
      const winCount = monthTrains.filter(
        t => t.tradeResult === '盈利'
      ).length;
      const thisMonthWinRate =
        thisMonthClosedSimulationCount === 0
          ? 0
          : Math.round((winCount / thisMonthClosedSimulationCount) * 100);

      return {
        thisMonthClosedSimulationCount,
        thisMonthWinRate,
      };
    } catch (error) {
      console.error('[SimulationTrainService] getThisMonthStats error:', error);
      throw new Error('模拟交易统计获取失败');
    }
  }

  async findByUserId(userId: string, page = 1, pageSize = 20) {
    try {
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

      const result = await this.db.query({
        TableName: this.tableName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
        Limit: pageSize,
        ScanIndexForward: false,
      });

      const mappedItems = result.Items as SimulationTrain[];

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
        '[SimulationTrainService] findByUserId error:',
        JSON.stringify(error),
      );
      throw new Error('模拟交易列表获取失败');
    }
  }

  async getSimulationTrain(userId: string, simulationTrainId: string) {
    try {
      const result = await this.db.get({
        TableName: this.tableName,
        Key: { userId, simulationTrainId },
      });

      if (!result.Item) {
        return {
          success: false,
          message: '模拟交易记录不存在',
        };
      }
      if (result.Item.userId !== userId) {
        throw new ForbiddenException('没有权限访问此模拟交易');
      }
      return {
        success: true,
        data: result.Item as SimulationTrain,
      };
    } catch (error) {
      console.error('[SimulationTrainService] getSimulationTrain error:', error);
      throw new Error('模拟交易记录获取失败');
    }
  }

  async updateSimulationTrain(
    userId: string,
    simulationTrainId: string,
    dto: UpdateSimulationTrainDto,
  ) {
    try {
      const oldRes = await this.getSimulationTrain(userId, simulationTrainId);
      if (!oldRes.success) throw new NotFoundException('模拟交易记录不存在');
      const existingSimulation = oldRes.data as SimulationTrain;
      const updatedSimulationData: Partial<SimulationTrain> = {
        ...dto,
        analysisTime: dto.analysisTime,
      };

      const updated: SimulationTrain = {
        ...existingSimulation,
        ...updatedSimulationData,
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
      console.error('[SimulationTrainService] updateSimulationTrain error:', error);
      throw new Error('模拟交易更新失败');
    }
  }

  async deleteSimulationTrain(userId: string, simulationTrainId: string) {
    try {
      const oldRes = await this.getSimulationTrain(userId, simulationTrainId);
      if (!oldRes.success) throw new NotFoundException('模拟交易记录不存在');
      await this.db.delete({
        TableName: this.tableName,
        Key: { userId, simulationTrainId },
      });
      return {
        success: true,
        message: '删除成功',
      };
    } catch (error) {
      console.error('[SimulationTrainService] deleteSimulationTrain error:', error);
      throw new Error('模拟交易删除失败');
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
      let filterExpression = '';
      const expressionAttributeValues: Record<string, any> = {
        ':userId': userId,
      };
      const expressionAttributeNames: Record<string, string> = {};

      if (filters.marketStructure && filters.marketStructure !== 'all') {
        filterExpression += filterExpression ? ' AND ' : '';
        filterExpression += '#marketStructure = :marketStructure';
        expressionAttributeValues[':marketStructure'] = filters.marketStructure;
        expressionAttributeNames['#marketStructure'] = 'marketStructure';
      }

      if (filters.entryDirection && filters.entryDirection !== 'all') {
        filterExpression += filterExpression ? ' AND ' : '';
        filterExpression += '#entryDirection = :entryDirection';
        expressionAttributeValues[':entryDirection'] = filters.entryDirection;
        expressionAttributeNames['#entryDirection'] = 'entryDirection';
      }

      if (filters.status && filters.status !== 'all') {
        filterExpression += filterExpression ? ' AND ' : '';
        filterExpression += '#status = :status';
        expressionAttributeValues[':status'] = filters.status;
        expressionAttributeNames['#status'] = 'status';
      }

      if (filters.tradeResult && filters.tradeResult !== 'all') {
        filterExpression += filterExpression ? ' AND ' : '';
        filterExpression += '#tradeResult = :tradeResult';
        expressionAttributeValues[':tradeResult'] = filters.tradeResult;
        expressionAttributeNames['#tradeResult'] = 'tradeResult';
      }

      if (filters.dateFrom) {
        filterExpression += filterExpression ? ' AND ' : '';
        filterExpression += '#createdAt >= :dateFrom';
        expressionAttributeValues[':dateFrom'] = filters.dateFrom;
        expressionAttributeNames['#createdAt'] = 'createdAt';
      }

      if (filters.dateTo) {
        filterExpression += filterExpression ? ' AND ' : '';
        filterExpression += '#createdAt <= :dateTo';
        expressionAttributeValues[':dateTo'] = filters.dateTo + 'T23:59:59.999Z';
        if (!expressionAttributeNames['#createdAt']) {
          expressionAttributeNames['#createdAt'] = 'createdAt';
        }
      }

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

      const queryParams: any = {
        TableName: this.tableName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: expressionAttributeValues,
        Limit: pageSize,
        ScanIndexForward: false,
      };

      if (filterExpression) {
        queryParams.FilterExpression = filterExpression;
        queryParams.ExpressionAttributeNames = expressionAttributeNames;
      }

      const result = await this.db.query(queryParams);
      const mappedItems = result.Items as SimulationTrain[];

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
      console.error('[SimulationTrainService] findByUserIdWithFilters error:', JSON.stringify(error));
      throw new Error('模拟交易列表获取失败');
    }
  }
}