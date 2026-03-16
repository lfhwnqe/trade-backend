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

    const item = (result.Items?.[0] || undefined) as DictionaryCategoryItem | undefined;
    if (!item) {
      throw new ResourceNotFoundException(
        'Dictionary category not found by code',
        ERROR_CODES.RESOURCE_NOT_FOUND,
        '字典分类不存在',
      );
    }
    return item;
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
