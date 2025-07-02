/**
 * MindMap实体类
 * 定义DynamoDB存储结构和数据转换逻辑
 */

import { 
  MindMapEntity, 
  MindMapData, 
  MindMapNodeData,
  MINDMAP_DEFAULTS 
} from '../types/mindmap.types';

/**
 * MindMap实体类
 * 用于DynamoDB数据存储和业务逻辑处理
 */
export class MindMapEntityClass implements MindMapEntity {
  // DynamoDB键
  PK: string;                        // 分区键: USER#{userId}
  SK: string;                        // 排序键: MINDMAP#{mindmapId}
  
  // 基础字段
  id: string;                        // 脑图ID
  userId: string;                    // 用户ID
  title: string;                     // 标题
  description?: string;              // 描述
  data: string;                      // JSON字符串存储的脑图数据
  layout: string;                    // 布局类型
  theme: string;                     // 主题
  viewData?: string;                 // 视图数据JSON字符串
  tags?: string[];                   // 标签数组
  version: string;                   // 版本
  createdAt: string;                 // 创建时间
  updatedAt: string;                 // 更新时间
  
  // GSI索引字段
  GSI1PK?: string;                   // GSI1分区键: TAG#{tag}
  GSI1SK?: string;                   // GSI1排序键: MINDMAP#{mindmapId}

  constructor(data: Partial<MindMapEntityClass> = {}) {
    // 必填字段
    this.id = data.id || this.generateId();
    this.userId = data.userId || '';
    this.title = data.title || '';
    
    // 可选字段
    this.description = data.description;
    this.data = data.data || this.getDefaultMindMapData();
    this.layout = data.layout || MINDMAP_DEFAULTS.LAYOUT;
    this.theme = data.theme || MINDMAP_DEFAULTS.THEME;
    this.viewData = data.viewData;
    this.tags = data.tags || [];
    this.version = data.version || MINDMAP_DEFAULTS.VERSION;
    
    // 时间戳
    const now = new Date().toISOString();
    this.createdAt = data.createdAt || now;
    this.updatedAt = data.updatedAt || now;
    
    // 设置DynamoDB键
    this.PK = this.generatePK(this.userId);
    this.SK = this.generateSK(this.id);
    
    // 设置GSI键（如果有标签）
    if (this.tags && this.tags.length > 0) {
      this.GSI1PK = this.generateGSI1PK(this.tags[0]);
      this.GSI1SK = this.generateGSI1SK(this.id);
    }
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `mindmap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成分区键
   */
  private generatePK(userId: string): string {
    return `USER#${userId}`;
  }

  /**
   * 生成排序键
   */
  private generateSK(mindmapId: string): string {
    return `MINDMAP#${mindmapId}`;
  }

  /**
   * 生成GSI1分区键
   */
  private generateGSI1PK(tag: string): string {
    return `TAG#${tag}`;
  }

  /**
   * 生成GSI1排序键
   */
  private generateGSI1SK(mindmapId: string): string {
    return `MINDMAP#${mindmapId}`;
  }

  /**
   * 获取默认脑图数据
   */
  private getDefaultMindMapData(): string {
    const defaultData: MindMapNodeData = {
      data: {
        text: '根节点',
        expand: true,
        uid: 'root',
      },
      children: []
    };
    return JSON.stringify(defaultData);
  }

  /**
   * 转换为业务数据格式
   */
  toMindMapData(): MindMapData {
    return {
      id: this.id,
      userId: this.userId,
      title: this.title,
      description: this.description,
      data: this.parseMindMapData(),
      layout: this.layout,
      theme: this.theme,
      viewData: this.parseViewData(),
      metadata: {
        version: this.version,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
        tags: this.tags,
      }
    };
  }

  /**
   * 解析脑图数据
   */
  private parseMindMapData(): MindMapNodeData {
    try {
      return JSON.parse(this.data);
    } catch (error) {
      console.error('Failed to parse mind map data:', error);
      return {
        data: {
          text: '根节点',
          expand: true,
          uid: 'root',
        },
        children: []
      };
    }
  }

  /**
   * 解析视图数据
   */
  private parseViewData(): any {
    if (!this.viewData) return null;
    try {
      return JSON.parse(this.viewData);
    } catch (error) {
      console.error('Failed to parse view data:', error);
      return null;
    }
  }

  /**
   * 从业务数据创建实体
   */
  static fromMindMapData(mindMapData: MindMapData): MindMapEntityClass {
    return new MindMapEntityClass({
      id: mindMapData.id,
      userId: mindMapData.userId,
      title: mindMapData.title,
      description: mindMapData.description,
      data: JSON.stringify(mindMapData.data),
      layout: mindMapData.layout,
      theme: mindMapData.theme,
      viewData: mindMapData.viewData ? JSON.stringify(mindMapData.viewData) : undefined,
      tags: mindMapData.metadata.tags,
      version: mindMapData.metadata.version,
      createdAt: mindMapData.metadata.createdAt,
      updatedAt: mindMapData.metadata.updatedAt,
    });
  }

  /**
   * 更新实体数据
   */
  update(updateData: Partial<MindMapData>): void {
    if (updateData.title !== undefined) {
      this.title = updateData.title;
    }
    if (updateData.description !== undefined) {
      this.description = updateData.description;
    }
    if (updateData.data !== undefined) {
      this.data = JSON.stringify(updateData.data);
    }
    if (updateData.layout !== undefined) {
      this.layout = updateData.layout;
    }
    if (updateData.theme !== undefined) {
      this.theme = updateData.theme;
    }
    if (updateData.viewData !== undefined) {
      this.viewData = updateData.viewData ? JSON.stringify(updateData.viewData) : undefined;
    }
    if (updateData.metadata?.tags !== undefined) {
      this.tags = updateData.metadata.tags;
      // 更新GSI键
      if (this.tags && this.tags.length > 0) {
        this.GSI1PK = this.generateGSI1PK(this.tags[0]);
        this.GSI1SK = this.generateGSI1SK(this.id);
      } else {
        this.GSI1PK = undefined;
        this.GSI1SK = undefined;
      }
    }
    
    // 更新时间戳
    this.updatedAt = new Date().toISOString();
  }

  /**
   * 验证实体数据
   */
  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.id) {
      errors.push('ID is required');
    }
    if (!this.userId) {
      errors.push('User ID is required');
    }
    if (!this.title || this.title.trim().length === 0) {
      errors.push('Title is required');
    }
    if (!this.data) {
      errors.push('Mind map data is required');
    } else {
      try {
        JSON.parse(this.data);
      } catch {
        errors.push('Mind map data must be valid JSON');
      }
    }
    if (!this.layout) {
      errors.push('Layout is required');
    }
    if (!this.theme) {
      errors.push('Theme is required');
    }
    if (!this.version) {
      errors.push('Version is required');
    }
    if (!this.createdAt) {
      errors.push('Created date is required');
    }
    if (!this.updatedAt) {
      errors.push('Updated date is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 转换为DynamoDB项目格式
   */
  toDynamoDBItem(): Record<string, any> {
    const item: Record<string, any> = {
      PK: this.PK,
      SK: this.SK,
      id: this.id,
      userId: this.userId,
      title: this.title,
      data: this.data,
      layout: this.layout,
      theme: this.theme,
      version: this.version,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };

    // 可选字段
    if (this.description) {
      item.description = this.description;
    }
    if (this.viewData) {
      item.viewData = this.viewData;
    }
    if (this.tags && this.tags.length > 0) {
      item.tags = this.tags;
    }
    if (this.GSI1PK) {
      item.GSI1PK = this.GSI1PK;
    }
    if (this.GSI1SK) {
      item.GSI1SK = this.GSI1SK;
    }

    return item;
  }
}
