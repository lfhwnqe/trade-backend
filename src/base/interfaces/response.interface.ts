/**
 * 标准化 API 响应接口
 * @template T 响应数据类型
 */
export interface ApiResponse<T = any> {
  /** 请求是否成功 */
  success: boolean;
  /** 响应数据 */
  data?: T;
  /** 成功消息 */
  message?: string;
  /** 错误信息 */
  error?: string;
  /** 响应时间戳 */
  timestamp: string;
}

/**
 * 分页元数据接口
 */
export interface PaginationMeta {
  /** 当前页码 */
  page: number;
  /** 每页大小 */
  pageSize: number;
  /** 总记录数 */
  total: number;
  /** 总页数 */
  totalPages: number;
  /** 是否有下一页 */
  hasNext: boolean;
  /** 是否有上一页 */
  hasPrevious: boolean;
}

/**
 * 分页响应接口
 * @template T 数据项类型
 */
export interface PaginatedResponse<T = any> {
  /** 数据列表 */
  items: T[];
  /** 分页元数据 */
  meta: PaginationMeta;
}

/**
 * 带分页的 API 响应接口
 * @template T 数据项类型
 */
export interface ApiPaginatedResponse<T = any>
  extends Omit<ApiResponse<PaginatedResponse<T>>, 'data'> {
  /** 分页数据 */
  data: PaginatedResponse<T>;
}

/**
 * 错误详情接口
 */
export interface ErrorDetail {
  /** 错误代码 */
  code: string;
  /** 错误字段 */
  field?: string;
  /** 错误描述 */
  message: string;
}

/**
 * 标准化错误响应接口
 */
export interface ErrorResponse {
  /** 请求失败标识 */
  success: false;
  /** 错误消息 */
  error: string;
  /** 错误详情列表 */
  details?: ErrorDetail[];
  /** 错误代码 */
  errorCode?: string;
  /** 请求ID（用于追踪） */
  requestId?: string;
  /** 响应时间戳 */
  timestamp: string;
}
