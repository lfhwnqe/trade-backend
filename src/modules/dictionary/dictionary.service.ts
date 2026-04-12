import { Injectable } from '@nestjs/common';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '../common/config.service';
import {
  BusinessException,
  DynamoDBException,
  ResourceNotFoundException,
  ValidationException,
} from '../../base/exceptions/custom.exceptions';
import { ERROR_CODES } from '../../base/constants/error-codes';
import { CreateDictionaryCategoryDto } from './dto/create-dictionary-category.dto';
import { UpdateDictionaryCategoryDto } from './dto/update-dictionary-category.dto';
import { ListDictionaryCategoriesDto } from './dto/list-dictionary-categories.dto';
import { CreateDictionaryItemDto } from './dto/create-dictionary-item.dto';
import { UpdateDictionaryItemDto } from './dto/update-dictionary-item.dto';
import { ListDictionaryItemsDto } from './dto/list-dictionary-items.dto';
import { GetDictionaryOptionsBatchDto } from './dto/get-dictionary-options-batch.dto';
import { ReorderDictionaryItemsDto } from './dto/reorder-dictionary-items.dto';
import { ReorderDictionaryCategoriesDto } from './dto/reorder-dictionary-categories.dto';
import {
  DictionaryCategoryItem,
  DictionaryEntryItem,
} from './dictionary.types';

const FLASHCARD_TAG_CATEGORY_SEED = {
  code: 'flashcard_tag',
  name: '闪卡标签',
  description: '用于标记 Flashcard 的执行特征、价格行为、结构环境与交易时段',
  bizType: 'FLASHCARD' as const,
  selectionMode: 'MULTIPLE' as const,
  sortOrder: 200,
};

const FLASHCARD_TAG_ITEMS_SEED = [
  { code: 'pending_order_entry', label: '提前挂单入场', description: '不追当前价格，提前在关键区域附近挂限价单等待成交', color: '#00c2b2', sortOrder: 100 },
  { code: 'retest_entry', label: '回踩入场', description: '等待突破后的回踩确认，再按原方向入场', color: '#00c2b2', sortOrder: 110 },
  { code: 'market_entry', label: '市价直接入场', description: '不等待挂单或深回踩，信号出现后直接跟随入场', color: '#00c2b2', sortOrder: 120 },
  { code: 'do_not_chase', label: '禁止追单', description: '当前动量或价格距离已经过大，直接追单会导致盈亏比失真', color: '#f59e0b', sortOrder: 130 },
  { code: 'time_stop_required', label: '需要时间止损', description: '若若干根K线内未走出预期方向扩张，需要按时间止损离场', color: '#f59e0b', sortOrder: 140 },
  { code: 'big_body_up', label: '强势大阳突破', description: '以明显大实体阳线完成向上突破或强势收盘', color: '#22c55e', sortOrder: 200 },
  { code: 'big_body_down', label: '强势下跌突破', description: '以明显大实体阴线完成向下突破或强势收盘', color: '#ef4444', sortOrder: 210 },
  { code: 'long_wick_rejection', label: '长影线拒绝', description: '价格刺穿关键区域后出现明显长影线，体现拒绝与反向承接', color: '#8b5cf6', sortOrder: 220 },
  { code: 'slow_compression', label: '缓慢挤压逼近', description: '价格持续以更接近关键区域的高低点推进，暗示区间即将被突破', color: '#8b5cf6', sortOrder: 230 },
  { code: 'engulfing_reversal', label: '吞没反转', description: '关键区域出现反向吞没K线，作为反转或承接确认', color: '#8b5cf6', sortOrder: 240 },
  { code: 'flip_zone', label: '支撑阻力互换', description: '原支撑跌破后转为阻力，或原阻力突破后转为支撑', color: '#3b82f6', sortOrder: 300 },
  { code: 'range_boundary', label: '区间边界', description: '信号发生在区间上沿或下沿附近，属于区间交易核心位置', color: '#3b82f6', sortOrder: 310 },
  { code: 'near_4h_resistance', label: '接近4H阻力', description: '当前行为发生在4小时背景阻力区域附近', color: '#3b82f6', sortOrder: 320 },
  { code: 'near_4h_support', label: '接近4H支撑', description: '当前行为发生在4小时背景支撑区域附近', color: '#3b82f6', sortOrder: 330 },
  { code: 'at_1h_bos_zone', label: '位于1H结构位', description: '信号发生在1小时 BOS / 结构确认区域附近', color: '#3b82f6', sortOrder: 340 },
  { code: 'chaotic_context', label: '混乱环境', description: '市场结构不清晰、原剧本被破坏或边界失效，需高度谨慎', color: '#6b7280', sortOrder: 350 },
  { code: 'asia_session', label: '亚盘', description: '题目主要发生在亚洲交易时段', color: '#14b8a6', sortOrder: 400 },
  { code: 'london_session', label: '欧盘', description: '题目主要发生在伦敦交易时段', color: '#14b8a6', sortOrder: 410 },
  { code: 'new_york_session', label: '美盘', description: '题目主要发生在纽约交易时段', color: '#14b8a6', sortOrder: 420 },
];

const MISTAKE_TYPE_CATEGORY_SEED = {
  code: 'mistake_type',
  name: '误判类型',
  description: '用于统一标记训练错误与真实交易错误的 taxonomy',
  bizType: 'COMMON' as const,
  selectionMode: 'MULTIPLE' as const,
  sortOrder: 300,
};

const MISTAKE_TYPE_ITEMS_SEED = [
  { code: 'MISREAD_PLAYBOOK', label: '剧本识别错误', description: '把当前行情误判成了错误剧本', color: '#64748b', sortOrder: 100 },
  { code: 'MISREAD_MARKET_STRUCTURE', label: '市场结构识别错误', description: '对趋势、震荡或切换结构判断错误', color: '#64748b', sortOrder: 110 },
  { code: 'MISREAD_BREAKOUT_QUALITY', label: '突破质量误判', description: '把低质量突破看成有效突破', color: '#64748b', sortOrder: 120 },
  { code: 'MISREAD_FAKE_BREAK', label: '假突破识别错误', description: '把假突破看成真突破，或反之', color: '#64748b', sortOrder: 130 },
  { code: 'MISREAD_CONTEXT_ALIGNMENT', label: '背景一致性误判', description: '忽略高周期或大背景方向', color: '#64748b', sortOrder: 140 },
  { code: 'MISREAD_REVERSAL_SIGNAL', label: '反转信号识别错误', description: '把延续误看成反转，或反之', color: '#64748b', sortOrder: 150 },
  { code: 'ENTRY_TOO_EARLY', label: '入场过早', description: '确认尚未完成就提前入场', color: '#f59e0b', sortOrder: 200 },
  { code: 'ENTRY_TOO_LATE', label: '入场过晚', description: '触发已完成、RR 明显恶化后才入场', color: '#f59e0b', sortOrder: 210 },
  { code: 'NO_CONFIRMATION_WAIT', label: '未等待确认', description: '本应等待 trigger confirm 却抢跑', color: '#f59e0b', sortOrder: 220 },
  { code: 'MISREAD_SECOND_TEST', label: '二次测试误判', description: '第二次测试尚未成立就进场', color: '#f59e0b', sortOrder: 230 },
  { code: 'CHASING_AFTER_EXPANSION', label: '扩张后追单', description: '明显扩张后追价入场', color: '#f59e0b', sortOrder: 240 },
  { code: 'LATE_REACTION_AFTER_SIGNAL', label: '信号滞后反应', description: '看到信号但迟疑太久才执行', color: '#f59e0b', sortOrder: 250 },
  { code: 'INVALID_STOP_LOGIC', label: '止损逻辑错误', description: '止损位置与入场逻辑不匹配', color: '#ef4444', sortOrder: 300 },
  { code: 'RR_NOT_ACCEPTABLE', label: 'RR 不可接受仍强做', description: '明知盈亏比不合格仍执行', color: '#ef4444', sortOrder: 310 },
  { code: 'POSITION_NOT_ACTIONABLE', label: '图形可看不可做', description: '识别方向可能对，但位置不具备可执行性', color: '#ef4444', sortOrder: 320 },
  { code: 'INVALID_ENTRY_STOP_RELATION', label: '入场与止损关系错误', description: '入场点与失效点距离不合理', color: '#ef4444', sortOrder: 330 },
  { code: 'NO_CLEAR_INVALIDATION', label: '没有明确失效点', description: '无法回答哪里算逻辑失效', color: '#ef4444', sortOrder: 340 },
  { code: 'TARGET_NOT_STRUCTURALLY_SUPPORTED', label: '止盈目标脱离结构', description: '目标设置没有结构依据', color: '#ef4444', sortOrder: 350 },
  { code: 'SHOULD_BE_NO_TRADE', label: '本应不做', description: '最优动作本应是 pass', color: '#8b5cf6', sortOrder: 400 },
  { code: 'RANGE_CHOP_ENVIRONMENT', label: '震荡环境误用趋势剧本', description: '在混乱环境里硬套趋势型做法', color: '#8b5cf6', sortOrder: 410 },
  { code: 'LOW_EDGE_SESSION_TIME', label: '低质量时段强做', description: '在低 edge 时段仍强行出手', color: '#8b5cf6', sortOrder: 420 },
  { code: 'HTF_CONFLICT', label: '高周期冲突', description: '与高周期背景明显冲突', color: '#8b5cf6', sortOrder: 430 },
  { code: 'NEWS_OR_EVENT_RISK_IGNORED', label: '忽略事件风险', description: '忽略消息或事件驱动的高风险背景', color: '#8b5cf6', sortOrder: 440 },
  { code: 'OVERCROWDING_SIGNALS', label: '条件过度拼凑', description: '勉强凑出理由，实际没有 clean edge', color: '#8b5cf6', sortOrder: 450 },
  { code: 'PLAN_NOT_FOLLOWED', label: '未按计划执行', description: '盘中偏离原计划', color: '#06b6d4', sortOrder: 500 },
  { code: 'HESITATION_MISS', label: '犹豫错失机会', description: '看对但没做，或错过最佳点', color: '#06b6d4', sortOrder: 510 },
  { code: 'IMPULSIVE_ENTRY', label: '冲动入场', description: '非计划内、情绪化入场', color: '#06b6d4', sortOrder: 520 },
  { code: 'MANAGEMENT_RULE_BROKEN', label: '持仓管理违规', description: '持仓中未按规则处理', color: '#06b6d4', sortOrder: 530 },
  { code: 'EXIT_EXECUTION_ERROR', label: '离场执行错误', description: '离场点、离场方式或执行顺序错误', color: '#06b6d4', sortOrder: 540 },
  { code: 'SIZE_NOT_ALIGNED', label: '仓位不匹配', description: '仓位配置与 setup 质量或风险不一致', color: '#06b6d4', sortOrder: 550 },
];

@Injectable()
export class DictionaryService {
  private readonly db: DynamoDBDocument;
  private readonly categoriesTableName: string;
  private readonly itemsTableName: string;
  private readonly region: string;
  private readonly categoriesCodeIndexName = 'userId-code-index';
  private readonly itemsCategoryCodeIndexName = 'categoryLookupKey-code-index';
  private readonly itemsCategorySortIndexName = 'categoryLookupKey-sortOrder-index';

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.getOrThrow('AWS_REGION');
    this.categoriesTableName = this.configService.getOrThrow(
      'DICTIONARY_CATEGORIES_TABLE_NAME',
    );
    this.itemsTableName = this.configService.getOrThrow(
      'DICTIONARY_ITEMS_TABLE_NAME',
    );

    this.db = DynamoDBDocument.from(new DynamoDB({ region: this.region }), {
      marshallOptions: { convertClassInstanceToMap: true },
    });
  }

  async createCategory(userId: string, dto: CreateDictionaryCategoryDto) {
    const code = dto.code.trim();
    await this.ensureCategoryCodeAvailable(userId, code);

    const now = new Date().toISOString();
    const item: DictionaryCategoryItem = {
      userId,
      categoryId: uuidv4(),
      code,
      name: dto.name.trim(),
      description: dto.description?.trim() || undefined,
      bizType: dto.bizType,
      selectionMode: dto.selectionMode,
      status: 'ACTIVE',
      sortOrder: dto.sortOrder ?? 100,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.db.put({
        TableName: this.categoriesTableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(categoryId)',
      });
    } catch (error) {
      throw new DynamoDBException(
        'Failed to create dictionary category',
        ERROR_CODES.DYNAMODB_OPERATION_FAILED,
        '创建字典分类失败',
        error,
      );
    }

    return { success: true, data: this.toCategoryResponse(item, 0) };
  }

  async listCategories(userId: string, dto: ListDictionaryCategoriesDto) {
    const items = await this.listAllCategories(userId);
    const keyword = dto.keyword?.trim().toLowerCase();

    const filtered = items.filter((item) => {
      if (dto.bizType && item.bizType !== dto.bizType) return false;
      if (dto.status && item.status !== dto.status) return false;
      if (keyword) {
        const haystack = `${item.code} ${item.name} ${item.description || ''}`.toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      return true;
    });

    const itemCountMap = await this.buildItemCountMap(userId);

    return {
      success: true,
      data: {
        items: filtered
          .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))
          .map((item) => this.toCategoryResponse(item, itemCountMap[item.code] || 0)),
      },
    };
  }

  async getCategory(userId: string, categoryId: string) {
    const item = await this.getCategoryOrThrow(userId, categoryId);
    const itemCountMap = await this.buildItemCountMap(userId);
    return {
      success: true,
      data: this.toCategoryResponse(item, itemCountMap[item.code] || 0),
    };
  }

  async updateCategory(
    userId: string,
    categoryId: string,
    dto: UpdateDictionaryCategoryDto,
  ) {
    const existing = await this.getCategoryOrThrow(userId, categoryId);
    const nextItem: DictionaryCategoryItem = {
      ...existing,
      name: dto.name?.trim() ?? existing.name,
      description:
        dto.description !== undefined
          ? dto.description.trim() || undefined
          : existing.description,
      bizType: dto.bizType ?? existing.bizType,
      selectionMode: dto.selectionMode ?? existing.selectionMode,
      status: dto.status ?? existing.status,
      sortOrder: dto.sortOrder ?? existing.sortOrder,
      updatedAt: new Date().toISOString(),
    };

    try {
      await this.db.put({
        TableName: this.categoriesTableName,
        Item: nextItem,
        ConditionExpression: 'attribute_exists(categoryId)',
      });
    } catch (error) {
      throw new DynamoDBException(
        'Failed to update dictionary category',
        ERROR_CODES.DYNAMODB_OPERATION_FAILED,
        '更新字典分类失败',
        error,
      );
    }

    const itemCountMap = await this.buildItemCountMap(userId);
    return {
      success: true,
      data: this.toCategoryResponse(nextItem, itemCountMap[nextItem.code] || 0),
    };
  }

  async deleteCategory(userId: string, categoryId: string) {
    const category = await this.getCategoryOrThrow(userId, categoryId);
    const items = await this.listItemsByCategoryCode(userId, category.code);
    if (items.length > 0) {
      throw new BusinessException(
        'Dictionary category is not empty',
        ERROR_CODES.BUSINESS_OPERATION_NOT_ALLOWED,
        '分类下仍有字典项，不能删除',
      );
    }

    try {
      await this.db.delete({
        TableName: this.categoriesTableName,
        Key: { userId, categoryId },
        ConditionExpression: 'attribute_exists(categoryId)',
      });
    } catch (error) {
      throw new DynamoDBException(
        'Failed to delete dictionary category',
        ERROR_CODES.DYNAMODB_OPERATION_FAILED,
        '删除字典分类失败',
        error,
      );
    }

    return { success: true, data: { categoryId } };
  }

  async createItem(userId: string, dto: CreateDictionaryItemDto) {
    const category = await this.getCategoryByCodeOrThrow(userId, dto.categoryCode.trim());
    const code = dto.code.trim();
    await this.ensureItemCodeAvailable(userId, category.code, code);

    const now = new Date().toISOString();
    const item: DictionaryEntryItem = {
      userId,
      itemId: uuidv4(),
      categoryCode: category.code,
      categoryLookupKey: this.buildCategoryLookupKey(userId, category.code),
      code,
      label: dto.label.trim(),
      alias: dto.alias?.map((value) => value.trim()).filter(Boolean),
      description: dto.description?.trim() || undefined,
      color: dto.color,
      status: 'ACTIVE',
      sortOrder: dto.sortOrder ?? 100,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.db.put({
        TableName: this.itemsTableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(itemId)',
      });
    } catch (error) {
      throw new DynamoDBException(
        'Failed to create dictionary item',
        ERROR_CODES.DYNAMODB_OPERATION_FAILED,
        '创建字典项失败',
        error,
      );
    }

    return { success: true, data: this.toDictionaryItemResponse(item) };
  }

  async listItems(userId: string, dto: ListDictionaryItemsDto) {
    if (dto.categoryCode) {
      await this.getCategoryByCodeOrThrow(userId, dto.categoryCode.trim());
    }

    const sourceItems = dto.categoryCode
      ? await this.listItemsByCategoryCode(userId, dto.categoryCode.trim())
      : await this.listAllItems(userId);

    const keyword = dto.keyword?.trim().toLowerCase();
    const filtered = sourceItems.filter((item) => {
      if (dto.status && item.status !== dto.status) return false;
      if (keyword) {
        const haystack = `${item.code} ${item.label} ${item.description || ''} ${(item.alias || []).join(' ')}`.toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      return true;
    });

    return {
      success: true,
      data: {
        items: filtered
          .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))
          .map((item) => this.toDictionaryItemResponse(item)),
      },
    };
  }

  async getItem(userId: string, itemId: string) {
    const item = await this.getItemOrThrow(userId, itemId);
    return { success: true, data: this.toDictionaryItemResponse(item) };
  }

  async updateItem(userId: string, itemId: string, dto: UpdateDictionaryItemDto) {
    const existing = await this.getItemOrThrow(userId, itemId);
    const nextItem: DictionaryEntryItem = {
      ...existing,
      label: dto.label?.trim() ?? existing.label,
      alias:
        dto.alias !== undefined
          ? dto.alias.map((value) => value.trim()).filter(Boolean)
          : existing.alias,
      description:
        dto.description !== undefined
          ? dto.description.trim() || undefined
          : existing.description,
      color: dto.color !== undefined ? dto.color : existing.color,
      status: dto.status ?? existing.status,
      sortOrder: dto.sortOrder ?? existing.sortOrder,
      updatedAt: new Date().toISOString(),
    };

    try {
      await this.db.put({
        TableName: this.itemsTableName,
        Item: nextItem,
        ConditionExpression: 'attribute_exists(itemId)',
      });
    } catch (error) {
      throw new DynamoDBException(
        'Failed to update dictionary item',
        ERROR_CODES.DYNAMODB_OPERATION_FAILED,
        '更新字典项失败',
        error,
      );
    }

    return { success: true, data: this.toDictionaryItemResponse(nextItem) };
  }

  async deleteItem(userId: string, itemId: string) {
    const item = await this.getItemOrThrow(userId, itemId);
    if (item.isSystem) {
      throw new BusinessException(
        'System dictionary item cannot be deleted',
        ERROR_CODES.BUSINESS_OPERATION_NOT_ALLOWED,
        '系统内置字典项不能删除',
      );
    }

    try {
      await this.db.delete({
        TableName: this.itemsTableName,
        Key: { userId, itemId },
        ConditionExpression: 'attribute_exists(itemId)',
      });
    } catch (error) {
      throw new DynamoDBException(
        'Failed to delete dictionary item',
        ERROR_CODES.DYNAMODB_OPERATION_FAILED,
        '删除字典项失败',
        error,
      );
    }

    return { success: true, data: { itemId } };
  }

  async getCategoryOptions(userId: string, categoryCode: string) {
    const category = await this.getCategoryByCodeOrThrow(userId, categoryCode.trim());
    if (category.status !== 'ACTIVE') {
      throw new ValidationException(
        'Dictionary category is disabled',
        ERROR_CODES.BUSINESS_OPERATION_NOT_ALLOWED,
        '该字典分类已停用，不能用于业务选择',
      );
    }

    const items = await this.listItemsByCategoryCode(userId, category.code);
    return {
      success: true,
      data: {
        category: {
          code: category.code,
          name: category.name,
          selectionMode: category.selectionMode,
        },
        items: items
          .filter((item) => item.status === 'ACTIVE')
          .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))
          .map((item) => ({
            code: item.code,
            label: item.label,
            color: item.color,
          })),
      },
    };
  }

  async getBatchCategoryOptions(userId: string, dto: GetDictionaryOptionsBatchDto) {
    const result: Record<string, any> = {};
    for (const rawCategoryCode of dto.categoryCodes) {
      const categoryCode = rawCategoryCode.trim();
      const option = await this.getCategoryOptions(userId, categoryCode);
      result[categoryCode] = {
        category: option.data.category,
        options: option.data.items,
      };
    }

    return {
      success: true,
      data: {
        items: result,
      },
    };
  }

  async reorderItems(userId: string, dto: ReorderDictionaryItemsDto) {
    const category = await this.getCategoryByCodeOrThrow(userId, dto.categoryCode.trim());
    const items = await this.listItemsByCategoryCode(userId, category.code);
    const itemMap = new Map(items.map((item) => [item.itemId, item]));

    for (const order of dto.orders) {
      const item = itemMap.get(order.itemId);
      if (!item) {
        throw new ResourceNotFoundException(
          'Dictionary item not found in category',
          ERROR_CODES.RESOURCE_NOT_FOUND,
          '存在不属于该分类的字典项',
        );
      }
    }

    await Promise.all(
      dto.orders.map(async (order) => {
        const current = itemMap.get(order.itemId)!;
        await this.db.put({
          TableName: this.itemsTableName,
          Item: {
            ...current,
            sortOrder: order.sortOrder,
            updatedAt: new Date().toISOString(),
          },
          ConditionExpression: 'attribute_exists(itemId)',
        });
      }),
    );

    return this.listItems(userId, { categoryCode: category.code });
  }

  async reorderCategories(userId: string, dto: ReorderDictionaryCategoriesDto) {
    const categories = await this.listAllCategories(userId);
    const categoryMap = new Map(categories.map((item) => [item.categoryId, item]));

    for (const order of dto.orders) {
      if (!categoryMap.has(order.categoryId)) {
        throw new ResourceNotFoundException(
          'Dictionary category not found',
          ERROR_CODES.RESOURCE_NOT_FOUND,
          '存在无效的字典分类',
        );
      }
    }

    await Promise.all(
      dto.orders.map(async (order) => {
        const current = categoryMap.get(order.categoryId)!;
        await this.db.put({
          TableName: this.categoriesTableName,
          Item: {
            ...current,
            sortOrder: order.sortOrder,
            updatedAt: new Date().toISOString(),
          },
          ConditionExpression: 'attribute_exists(categoryId)',
        });
      }),
    );

    return this.listCategories(userId, {});
  }

  async seedFlashcardTags(userId: string) {
    const now = new Date().toISOString();
    let category = await this.findCategoryByCode(userId, FLASHCARD_TAG_CATEGORY_SEED.code);

    if (!category) {
      category = {
        userId,
        categoryId: uuidv4(),
        code: FLASHCARD_TAG_CATEGORY_SEED.code,
        name: FLASHCARD_TAG_CATEGORY_SEED.name,
        description: FLASHCARD_TAG_CATEGORY_SEED.description,
        bizType: FLASHCARD_TAG_CATEGORY_SEED.bizType,
        selectionMode: FLASHCARD_TAG_CATEGORY_SEED.selectionMode,
        status: 'ACTIVE',
        sortOrder: FLASHCARD_TAG_CATEGORY_SEED.sortOrder,
        createdAt: now,
        updatedAt: now,
      };

      await this.db.put({
        TableName: this.categoriesTableName,
        Item: category,
      });
    } else {
      category = {
        ...category,
        name: FLASHCARD_TAG_CATEGORY_SEED.name,
        description: FLASHCARD_TAG_CATEGORY_SEED.description,
        bizType: FLASHCARD_TAG_CATEGORY_SEED.bizType,
        selectionMode: FLASHCARD_TAG_CATEGORY_SEED.selectionMode,
        status: 'ACTIVE',
        sortOrder: FLASHCARD_TAG_CATEGORY_SEED.sortOrder,
        updatedAt: now,
      };

      await this.db.put({
        TableName: this.categoriesTableName,
        Item: category,
        ConditionExpression: 'attribute_exists(categoryId)',
      });
    }

    const existingItems = await this.listItemsByCategoryCode(userId, FLASHCARD_TAG_CATEGORY_SEED.code);
    const existingItemMap = new Map(existingItems.map((item) => [item.code, item]));

    let created = 0;
    let updated = 0;

    for (const seed of FLASHCARD_TAG_ITEMS_SEED) {
      const existing = existingItemMap.get(seed.code);
      if (!existing) {
        const item: DictionaryEntryItem = {
          userId,
          itemId: uuidv4(),
          categoryCode: FLASHCARD_TAG_CATEGORY_SEED.code,
          categoryLookupKey: this.buildCategoryLookupKey(userId, FLASHCARD_TAG_CATEGORY_SEED.code),
          code: seed.code,
          label: seed.label,
          description: seed.description,
          color: seed.color,
          sortOrder: seed.sortOrder,
          status: 'ACTIVE',
          createdAt: now,
          updatedAt: now,
        };

        await this.db.put({
          TableName: this.itemsTableName,
          Item: item,
        });
        created += 1;
      } else {
        await this.db.put({
          TableName: this.itemsTableName,
          Item: {
            ...existing,
            label: seed.label,
            description: seed.description,
            color: seed.color,
            sortOrder: seed.sortOrder,
            status: 'ACTIVE',
            updatedAt: now,
          },
          ConditionExpression: 'attribute_exists(itemId)',
        });
        updated += 1;
      }
    }

    const options = await this.getCategoryOptions(userId, FLASHCARD_TAG_CATEGORY_SEED.code);

    return {
      success: true,
      data: {
        category: this.toCategoryResponse(category, options.data.items.length),
        created,
        updated,
        total: FLASHCARD_TAG_ITEMS_SEED.length,
        items: options.data.items,
      },
    };
  }

  async seedMistakeTypes(userId: string) {
    return this.seedCategoryItems(userId, MISTAKE_TYPE_CATEGORY_SEED, MISTAKE_TYPE_ITEMS_SEED);
  }

  async resolveCategoryItemsByCodes(
    userId: string,
    categoryCode: string,
    codes?: string[],
  ) {
    const normalizedCodes = Array.from(
      new Set((codes || []).map((item) => `${item}`.trim()).filter(Boolean)),
    );
    if (normalizedCodes.length === 0) {
      return [] as Array<{
        code: string;
        label: string;
        color?: string;
        status: string;
      }>;
    }

    await this.getCategoryByCodeOrThrow(userId, categoryCode);
    const items = await this.listItemsByCategoryCode(userId, categoryCode);
    const itemMap = new Map(items.map((item) => [item.code, item]));

    return normalizedCodes
      .map((code) => itemMap.get(code))
      .filter((item): item is DictionaryEntryItem => !!item)
      .map((item) => ({
        code: item.code,
        label: item.label,
        color: item.color,
        status: item.status,
      }));
  }

  async assertCategoryCodesExist(
    userId: string,
    categoryCode: string,
    codes?: string[],
  ) {
    const normalizedCodes = Array.from(
      new Set((codes || []).map((item) => `${item}`.trim()).filter(Boolean)),
    );
    if (normalizedCodes.length === 0) {
      return [] as string[];
    }

    await this.getCategoryByCodeOrThrow(userId, categoryCode);
    const items = await this.listItemsByCategoryCode(userId, categoryCode);
    const itemMap = new Map(items.map((item) => [item.code, item]));
    const missingCodes = normalizedCodes.filter((code) => !itemMap.has(code));
    if (missingCodes.length > 0) {
      throw new ValidationException(
        'Dictionary option code not found',
        ERROR_CODES.VALIDATION_INVALID_VALUE,
        `存在无效的字典编码：${missingCodes.join(', ')}`,
        { categoryCode, missingCodes },
      );
    }

    return normalizedCodes;
  }

  private async getCategoryOrThrow(userId: string, categoryId: string) {
    const result = await this.db.get({
      TableName: this.categoriesTableName,
      Key: { userId, categoryId },
    });
    const item = result.Item as DictionaryCategoryItem | undefined;
    if (!item) {
      throw new ResourceNotFoundException(
        'Dictionary category not found',
        ERROR_CODES.RESOURCE_NOT_FOUND,
        '字典分类不存在',
      );
    }
    return item;
  }

  private async getItemOrThrow(userId: string, itemId: string) {
    const result = await this.db.get({
      TableName: this.itemsTableName,
      Key: { userId, itemId },
    });
    const item = result.Item as DictionaryEntryItem | undefined;
    if (!item) {
      throw new ResourceNotFoundException(
        'Dictionary item not found',
        ERROR_CODES.RESOURCE_NOT_FOUND,
        '字典项不存在',
      );
    }
    return item;
  }

  private async getCategoryByCodeOrThrow(userId: string, categoryCode: string) {
    const item = await this.findCategoryByCode(userId, categoryCode);
    if (!item) {
      throw new ResourceNotFoundException(
        'Dictionary category not found by code',
        ERROR_CODES.RESOURCE_NOT_FOUND,
        '字典分类不存在',
      );
    }
    return item;
  }

  private async findCategoryByCode(userId: string, categoryCode: string) {
    const code = categoryCode.trim();
    const result = await this.db.query({
      TableName: this.categoriesTableName,
      IndexName: this.categoriesCodeIndexName,
      KeyConditionExpression: 'userId = :userId AND code = :code',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':code': code,
      },
      Limit: 1,
    });

    return (result.Items?.[0] || undefined) as DictionaryCategoryItem | undefined;
  }

  private async ensureCategoryCodeAvailable(userId: string, categoryCode: string) {
    const result = await this.db.query({
      TableName: this.categoriesTableName,
      IndexName: this.categoriesCodeIndexName,
      KeyConditionExpression: 'userId = :userId AND code = :code',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':code': categoryCode,
      },
      Limit: 1,
    });

    if ((result.Items || []).length > 0) {
      throw new BusinessException(
        'Dictionary category code already exists',
        ERROR_CODES.BUSINESS_RESOURCE_CONFLICT,
        '字典分类编码已存在',
      );
    }
  }

  private async ensureItemCodeAvailable(
    userId: string,
    categoryCode: string,
    itemCode: string,
  ) {
    const result = await this.db.query({
      TableName: this.itemsTableName,
      IndexName: this.itemsCategoryCodeIndexName,
      KeyConditionExpression: 'categoryLookupKey = :lookupKey AND code = :code',
      ExpressionAttributeValues: {
        ':lookupKey': this.buildCategoryLookupKey(userId, categoryCode),
        ':code': itemCode,
      },
      Limit: 1,
    });

    if ((result.Items || []).length > 0) {
      throw new BusinessException(
        'Dictionary item code already exists',
        ERROR_CODES.BUSINESS_RESOURCE_CONFLICT,
        '该分类下字典项编码已存在',
      );
    }
  }

  private async listAllCategories(userId: string) {
    const items: DictionaryCategoryItem[] = [];
    let lastKey: Record<string, any> | undefined;

    do {
      const result = await this.db.query({
        TableName: this.categoriesTableName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
        ExclusiveStartKey: lastKey,
      });
      items.push(...((result.Items || []) as DictionaryCategoryItem[]));
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    return items;
  }

  private async listAllItems(userId: string) {
    const items: DictionaryEntryItem[] = [];
    let lastKey: Record<string, any> | undefined;

    do {
      const result = await this.db.query({
        TableName: this.itemsTableName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
        ExclusiveStartKey: lastKey,
      });
      items.push(...((result.Items || []) as DictionaryEntryItem[]));
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    return items;
  }

  private async listItemsByCategoryCode(userId: string, categoryCode: string) {
    const items: DictionaryEntryItem[] = [];
    let lastKey: Record<string, any> | undefined;

    do {
      const result = await this.db.query({
        TableName: this.itemsTableName,
        IndexName: this.itemsCategorySortIndexName,
        KeyConditionExpression: 'categoryLookupKey = :lookupKey',
        ExpressionAttributeValues: {
          ':lookupKey': this.buildCategoryLookupKey(userId, categoryCode),
        },
        ExclusiveStartKey: lastKey,
      });
      items.push(...((result.Items || []) as DictionaryEntryItem[]));
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    return items;
  }

  private async buildItemCountMap(userId: string) {
    const items = await this.listAllItems(userId);
    return items.reduce<Record<string, number>>((acc, item) => {
      acc[item.categoryCode] = (acc[item.categoryCode] || 0) + 1;
      return acc;
    }, {});
  }

  private buildCategoryLookupKey(userId: string, categoryCode: string) {
    return `${userId}#${categoryCode}`;
  }

  private async seedCategoryItems(
    userId: string,
    categorySeed: {
      code: string;
      name: string;
      description: string;
      bizType: 'COMMON' | 'FLASHCARD' | 'TRADE';
      selectionMode: 'SINGLE' | 'MULTIPLE';
      sortOrder: number;
    },
    itemSeeds: Array<{
      code: string;
      label: string;
      description?: string;
      color?: string;
      sortOrder: number;
    }>,
  ) {
    const now = new Date().toISOString();
    let category = await this.findCategoryByCode(userId, categorySeed.code);

    if (!category) {
      category = {
        userId,
        categoryId: uuidv4(),
        code: categorySeed.code,
        name: categorySeed.name,
        description: categorySeed.description,
        bizType: categorySeed.bizType,
        selectionMode: categorySeed.selectionMode,
        status: 'ACTIVE',
        sortOrder: categorySeed.sortOrder,
        createdAt: now,
        updatedAt: now,
      };

      await this.db.put({ TableName: this.categoriesTableName, Item: category });
    } else {
      category = {
        ...category,
        name: categorySeed.name,
        description: categorySeed.description,
        bizType: categorySeed.bizType,
        selectionMode: categorySeed.selectionMode,
        status: 'ACTIVE',
        sortOrder: categorySeed.sortOrder,
        updatedAt: now,
      };

      await this.db.put({
        TableName: this.categoriesTableName,
        Item: category,
        ConditionExpression: 'attribute_exists(categoryId)',
      });
    }

    const existingItems = await this.listItemsByCategoryCode(userId, categorySeed.code);
    const existingItemMap = new Map(existingItems.map((item) => [item.code, item]));
    let created = 0;
    let updated = 0;

    for (const seed of itemSeeds) {
      const existing = existingItemMap.get(seed.code);
      if (!existing) {
        const item: DictionaryEntryItem = {
          userId,
          itemId: uuidv4(),
          categoryCode: categorySeed.code,
          categoryLookupKey: this.buildCategoryLookupKey(userId, categorySeed.code),
          code: seed.code,
          label: seed.label,
          description: seed.description,
          color: seed.color,
          sortOrder: seed.sortOrder,
          status: 'ACTIVE',
          createdAt: now,
          updatedAt: now,
        };
        await this.db.put({ TableName: this.itemsTableName, Item: item });
        created += 1;
      } else {
        await this.db.put({
          TableName: this.itemsTableName,
          Item: {
            ...existing,
            label: seed.label,
            description: seed.description,
            color: seed.color,
            sortOrder: seed.sortOrder,
            status: 'ACTIVE',
            updatedAt: now,
          },
          ConditionExpression: 'attribute_exists(itemId)',
        });
        updated += 1;
      }
    }

    const options = await this.getCategoryOptions(userId, categorySeed.code);
    return {
      success: true,
      data: {
        category: this.toCategoryResponse(category, options.data.items.length),
        created,
        updated,
        total: itemSeeds.length,
        items: options.data.items,
      },
    };
  }

  private toCategoryResponse(item: DictionaryCategoryItem, itemCount: number) {
    return {
      categoryId: item.categoryId,
      code: item.code,
      name: item.name,
      description: item.description,
      bizType: item.bizType,
      selectionMode: item.selectionMode,
      status: item.status,
      sortOrder: item.sortOrder,
      itemCount,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private toDictionaryItemResponse(item: DictionaryEntryItem) {
    return {
      itemId: item.itemId,
      categoryCode: item.categoryCode,
      code: item.code,
      label: item.label,
      alias: item.alias,
      description: item.description,
      color: item.color,
      status: item.status,
      sortOrder: item.sortOrder,
      isSystem: item.isSystem,
      usageCount: item.usageCount,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
