/**
 * MindMap模块类型定义
 * 兼容simple-mind-map库的数据格式
 */

// ============================================================================
// 基础类型定义
// ============================================================================

/**
 * 脑图节点数据结构（兼容simple-mind-map格式）
 */
export interface MindMapNodeData {
  data: {
    text: string;                    // 节点文本
    richText?: boolean;              // 是否富文本
    expand?: boolean;                // 是否展开
    isActive?: boolean;              // 是否激活
    uid?: string;                    // 节点唯一ID
    icon?: any[];                    // 图标数组
    image?: string;                  // 图片URL
    imageTitle?: string;             // 图片标题
    imageSize?: {                    // 图片尺寸
      width: number;
      height: number;
      custom?: boolean;
    };
    hyperlink?: string;              // 超链接
    hyperlinkTitle?: string;         // 超链接标题
    note?: string;                   // 备注内容
    tag?: any[];                     // 标签数组
    generalization?: any[];          // 概要数组
    associativeLineTargets?: string[]; // 关联线目标节点ID列表
    associativeLineText?: any;       // 关联线文本
    associativeLinePoint?: any[];    // 关联线坐标数据
    associativeLineTargetControlOffsets?: any[]; // 关联线坐标偏移数据
    associativeLineStyle?: any;      // 关联线样式
    customLeft?: number;             // 自定义位置X
    customTop?: number;              // 自定义位置Y
    customTextWidth?: number;        // 自定义文本宽度
    dir?: string;                    // 节点排列方向
    // 其他样式字段可以根据主题扩展
    [key: string]: any;
  };
  children?: MindMapNodeData[];      // 子节点数组
}

/**
 * 脑图完整数据结构
 */
export interface MindMapData {
  id: string;                        // 脑图唯一ID
  userId: string;                    // 用户ID
  title: string;                     // 脑图标题
  description?: string;              // 脑图描述
  data: MindMapNodeData;             // 脑图节点数据
  layout?: string;                   // 布局类型
  theme?: string;                    // 主题名称
  viewData?: any;                    // 视图数据（位置、缩放等）
  metadata: {
    version: string;                 // 数据版本
    createdAt: string;               // 创建时间
    updatedAt: string;               // 更新时间
    tags?: string[];                 // 标签数组
  };
}

/**
 * DynamoDB存储实体结构
 */
export interface MindMapEntity {
  PK: string;                        // 分区键: USER#{userId}
  SK: string;                        // 排序键: MINDMAP#{mindmapId}
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
  GSI1PK?: string;                   // GSI1分区键: TAG#{tag}
  GSI1SK?: string;                   // GSI1排序键: MINDMAP#{mindmapId}
}

// ============================================================================
// API相关类型定义
// ============================================================================

/**
 * 创建脑图请求数据
 */
export interface CreateMindMapRequest {
  title: string;
  description?: string;
  data?: MindMapNodeData;
  layout?: string;
  theme?: string;
  viewData?: any;
  tags?: string[];
}

/**
 * 更新脑图请求数据
 */
export interface UpdateMindMapRequest {
  title?: string;
  description?: string;
  data?: MindMapNodeData;
  layout?: string;
  theme?: string;
  viewData?: any;
  tags?: string[];
}

/**
 * 脑图查询参数
 */
export interface MindMapQueryParams {
  page?: number;
  pageSize?: number;
  tags?: string[];
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
  lastEvaluatedKey?: string; // DynamoDB分页键
}

/**
 * 脑图列表项
 */
export interface MindMapListItem {
  id: string;
  title: string;
  description?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  layout: string;
  theme: string;
}

// ============================================================================
// 响应格式类型定义
// ============================================================================

/**
 * 统一API响应格式
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  timestamp: string;
}

/**
 * 分页响应格式
 */
export interface PaginatedResponse<T = any> {
  success: boolean;
  data: {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
  message?: string;
  timestamp: string;
}

// ============================================================================
// 错误类型定义
// ============================================================================

/**
 * 脑图相关错误类型
 */
export enum MindMapErrorType {
  NOT_FOUND = 'MINDMAP_NOT_FOUND',
  INVALID_DATA = 'INVALID_MINDMAP_DATA',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
}

/**
 * 脑图错误详情
 */
export interface MindMapError {
  type: MindMapErrorType;
  message: string;
  details?: any;
}

// ============================================================================
// 常量定义
// ============================================================================

/**
 * 支持的布局类型
 */
export const MINDMAP_LAYOUTS = {
  LOGICAL_STRUCTURE: 'logicalStructure',
  LOGICAL_STRUCTURE_LEFT: 'logicalStructureLeft',
  MIND_MAP: 'mindMap',
  CATALOG_ORGANIZATION: 'catalogOrganization',
  ORGANIZATION_STRUCTURE: 'organizationStructure',
  TIMELINE: 'timeline',
  TIMELINE2: 'timeline2',
  FISHBONE: 'fishbone',
  FISHBONE2: 'fishbone2',
  RIGHT_FISHBONE: 'rightFishbone',
  RIGHT_FISHBONE2: 'rightFishbone2',
  VERTICAL_TIMELINE: 'verticalTimeline',
  VERTICAL_TIMELINE2: 'verticalTimeline2',
  VERTICAL_TIMELINE3: 'verticalTimeline3',
} as const;

/**
 * 支持的主题类型
 */
export const MINDMAP_THEMES = {
  DEFAULT: 'default',
  CLASSIC: 'classic',
  DARK: 'dark',
  BLUE_SKY: 'blueSky',
  FRESH_GREEN: 'freshGreen',
  ROMANTIC_PURPLE: 'romanticPurple',
} as const;

/**
 * 默认配置
 */
export const MINDMAP_DEFAULTS = {
  LAYOUT: MINDMAP_LAYOUTS.LOGICAL_STRUCTURE,
  THEME: MINDMAP_THEMES.DEFAULT,
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  VERSION: '1.0.0',
} as const;

// ============================================================================
// 类型导出
// ============================================================================

export type MindMapLayoutType = typeof MINDMAP_LAYOUTS[keyof typeof MINDMAP_LAYOUTS];
export type MindMapThemeType = typeof MINDMAP_THEMES[keyof typeof MINDMAP_THEMES];
