import {
  ApiResponse,
  PaginatedResponse,
  ApiPaginatedResponse,
  ErrorResponse,
  PaginationMeta,
} from '../interfaces/response.interface';

/**
 * 响应助手工具类
 *
 * 提供标准化响应格式的静态方法，
 * 用于在服务层或控制器中快速创建标准格式的响应。
 */
export class ResponseHelper {
  /**
   * 创建成功响应
   *
   * @param data - 响应数据
   * @param message - 成功消息
   * @returns 标准化的成功响应
   *
   * @example
   * ```typescript
   * return ResponseHelper.success(user, '用户创建成功');
   * ```
   */
  static success<T>(data?: T, message?: string): ApiResponse<T> {
    return {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 创建分页响应
   *
   * @param items - 数据项数组
   * @param page - 当前页码
   * @param pageSize - 每页大小
   * @param total - 总记录数
   * @param message - 成功消息
   * @returns 标准化的分页响应
   *
   * @example
   * ```typescript
   * return ResponseHelper.paginated(users, 1, 10, 100, '获取用户列表成功');
   * ```
   */
  static paginated<T>(
    items: T[],
    page: number,
    pageSize: number,
    total: number,
    message?: string,
  ): ApiPaginatedResponse<T> {
    const totalPages = Math.ceil(total / pageSize);
    const hasNext = page < totalPages;
    const hasPrevious = page > 1;

    const meta: PaginationMeta = {
      page,
      pageSize,
      total,
      totalPages,
      hasNext,
      hasPrevious,
    };

    const paginatedData: PaginatedResponse<T> = {
      items,
      meta,
    };

    return {
      success: true,
      data: paginatedData,
      message,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 创建错误响应
   *
   * @param error - 错误消息
   * @param errorCode - 错误代码
   * @param details - 错误详情
   * @param requestId - 请求ID
   * @returns 标准化的错误响应
   *
   * @example
   * ```typescript
   * return ResponseHelper.error('用户不存在', 'USER_NOT_FOUND');
   * ```
   */
  static error(
    error: string,
    errorCode?: string,
    details?: Array<{
      code: string;
      field?: string;
      message: string;
    }>,
    requestId?: string,
  ): ErrorResponse {
    return {
      success: false,
      error,
      errorCode,
      details,
      requestId,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 创建验证错误响应
   *
   * @param message - 错误消息
   * @param validationErrors - 验证错误详情
   * @returns 标准化的验证错误响应
   *
   * @example
   * ```typescript
   * return ResponseHelper.validationError('请求参数验证失败', [
   *   { code: 'REQUIRED', field: 'email', message: '邮箱不能为空' }
   * ]);
   * ```
   */
  static validationError(
    message: string = '请求参数验证失败',
    validationErrors: Array<{
      code: string;
      field: string;
      message: string;
    }> = [],
  ): ErrorResponse {
    return this.error(message, 'VALIDATION_ERROR', validationErrors);
  }

  /**
   * 创建未授权响应
   *
   * @param message - 错误消息
   * @returns 标准化的未授权响应
   *
   * @example
   * ```typescript
   * return ResponseHelper.unauthorized('令牌已过期');
   * ```
   */
  static unauthorized(message: string = '未授权访问'): ErrorResponse {
    return this.error(message, 'UNAUTHORIZED');
  }

  /**
   * 创建禁止访问响应
   *
   * @param message - 错误消息
   * @returns 标准化的禁止访问响应
   *
   * @example
   * ```typescript
   * return ResponseHelper.forbidden('权限不足');
   * ```
   */
  static forbidden(message: string = '权限不足'): ErrorResponse {
    return this.error(message, 'FORBIDDEN');
  }

  /**
   * 创建资源不存在响应
   *
   * @param message - 错误消息
   * @returns 标准化的资源不存在响应
   *
   * @example
   * ```typescript
   * return ResponseHelper.notFound('用户不存在');
   * ```
   */
  static notFound(message: string = '资源不存在'): ErrorResponse {
    return this.error(message, 'NOT_FOUND');
  }

  /**
   * 创建服务器内部错误响应
   *
   * @param message - 错误消息
   * @param requestId - 请求ID（用于追踪）
   * @returns 标准化的服务器错误响应
   *
   * @example
   * ```typescript
   * return ResponseHelper.internalError('服务器内部错误', 'req-123');
   * ```
   */
  static internalError(
    message: string = '服务器内部错误',
    requestId?: string,
  ): ErrorResponse {
    return this.error(message, 'INTERNAL_SERVER_ERROR', undefined, requestId);
  }

  /**
   * 创建分页元数据
   *
   * @param page - 当前页码
   * @param pageSize - 每页大小
   * @param total - 总记录数
   * @returns 分页元数据
   *
   * @example
   * ```typescript
   * const meta = ResponseHelper.createPaginationMeta(1, 10, 100);
   * ```
   */
  static createPaginationMeta(
    page: number,
    pageSize: number,
    total: number,
  ): PaginationMeta {
    const totalPages = Math.ceil(total / pageSize);
    const hasNext = page < totalPages;
    const hasPrevious = page > 1;

    return {
      page,
      pageSize,
      total,
      totalPages,
      hasNext,
      hasPrevious,
    };
  }

  /**
   * 从查询参数创建分页选项
   *
   * @param query - 查询参数对象
   * @param defaultPage - 默认页码
   * @param defaultPageSize - 默认每页大小
   * @param maxPageSize - 最大每页大小
   * @returns 分页选项
   *
   * @example
   * ```typescript
   * const { page, pageSize } = ResponseHelper.getPaginationFromQuery(req.query);
   * ```
   */
  static getPaginationFromQuery(
    query: any,
    defaultPage: number = 1,
    defaultPageSize: number = 10,
    maxPageSize: number = 100,
  ): { page: number; pageSize: number } {
    let page = parseInt(query.page) || defaultPage;
    let pageSize = parseInt(query.pageSize) || defaultPageSize;

    // 确保页码最小为1
    page = Math.max(1, page);

    // 限制每页大小
    pageSize = Math.min(Math.max(1, pageSize), maxPageSize);

    return { page, pageSize };
  }

  /**
   * 检查对象是否为标准API响应格式
   *
   * @param obj - 待检查的对象
   * @returns 是否为标准API响应格式
   *
   * @example
   * ```typescript
   * if (ResponseHelper.isApiResponse(data)) {
   *   // 已经是标准格式
   * }
   * ```
   */
  static isApiResponse(obj: any): obj is ApiResponse {
    return (
      obj &&
      typeof obj === 'object' &&
      'success' in obj &&
      'timestamp' in obj &&
      typeof obj.success === 'boolean'
    );
  }

  /**
   * 检查对象是否为分页响应格式
   *
   * @param obj - 待检查的对象
   * @returns 是否为分页响应格式
   *
   * @example
   * ```typescript
   * if (ResponseHelper.isPaginatedResponse(data)) {
   *   // 是分页响应
   * }
   * ```
   */
  static isPaginatedResponse(obj: any): obj is ApiPaginatedResponse {
    return (
      this.isApiResponse(obj) &&
      obj.data &&
      typeof obj.data === 'object' &&
      'items' in obj.data &&
      'meta' in obj.data &&
      Array.isArray(obj.data.items)
    );
  }
}