import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiResponse,
  ApiResponseOptions,
  getSchemaPath,
} from '@nestjs/swagger';
import { HttpStatus } from '@nestjs/common';

/**
 * 标准化 API 响应装饰器选项
 */
export interface StandardResponseOptions {
  /** 响应描述 */
  description?: string;
  /** 数据类型 */
  type?: Type<any> | string;
  /** HTTP 状态码 */
  status?: HttpStatus;
  /** 是否为数组类型 */
  isArray?: boolean;
}

/**
 * 分页响应装饰器选项
 */
export interface PaginatedResponseOptions
  extends Omit<StandardResponseOptions, 'type'> {
  /** 数据项类型 */
  type: Type<any> | string;
}

/**
 * 错误响应装饰器选项
 */
export interface ErrorResponseOptions {
  /** 错误描述 */
  description?: string;
  /** HTTP 状态码 */
  status: HttpStatus;
}

/**
 * 标准成功响应装饰器
 *
 * 用于装饰返回标准 ApiResponse 格式的端点
 *
 * @param options - 响应配置选项
 * @returns 装饰器函数
 *
 * @example
 * ```typescript
 * @ApiStandardResponse({
 *   description: '获取用户信息成功',
 *   type: UserDto,
 *   status: HttpStatus.OK
 * })
 * async getUser() {
 *   // ...
 * }
 * ```
 */
export function ApiStandardResponse(options: StandardResponseOptions = {}) {
  const {
    description = '操作成功',
    type,
    status = HttpStatus.OK,
    isArray = false,
  } = options;

  const responseOptions: ApiResponseOptions = {
    status,
    description,
    schema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          example: true,
          description: '请求是否成功',
        },
        data: type
          ? isArray
            ? {
                type: 'array',
                items: { $ref: getSchemaPath(type as Type) },
                description: '响应数据',
              }
            : {
                $ref: getSchemaPath(type as Type),
                description: '响应数据',
              }
          : {
              description: '响应数据',
            },
        message: {
          type: 'string',
          description: '成功消息',
          example: description,
        },
        timestamp: {
          type: 'string',
          format: 'date-time',
          description: '响应时间戳',
          example: '2024-01-15T10:30:00Z',
        },
      },
      required: ['success', 'timestamp'],
    },
  };

  return applyDecorators(ApiResponse(responseOptions));
}

/**
 * 分页响应装饰器
 *
 * 用于装饰返回分页数据的端点
 *
 * @param options - 分页响应配置选项
 * @returns 装饰器函数
 *
 * @example
 * ```typescript
 * @ApiPaginatedResponse({
 *   description: '获取用户列表成功',
 *   type: UserDto
 * })
 * async getUsers() {
 *   // ...
 * }
 * ```
 */
export function ApiPaginatedResponse(options: PaginatedResponseOptions) {
  const {
    description = '获取分页数据成功',
    type,
    status = HttpStatus.OK,
  } = options;

  const responseOptions: ApiResponseOptions = {
    status,
    description,
    schema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          example: true,
          description: '请求是否成功',
        },
        data: {
          type: 'object',
          description: '分页数据',
          properties: {
            items: {
              type: 'array',
              items: { $ref: getSchemaPath(type as Type) },
              description: '数据列表',
            },
            meta: {
              type: 'object',
              description: '分页元数据',
              properties: {
                page: {
                  type: 'number',
                  description: '当前页码',
                  example: 1,
                },
                pageSize: {
                  type: 'number',
                  description: '每页大小',
                  example: 10,
                },
                total: {
                  type: 'number',
                  description: '总记录数',
                  example: 100,
                },
                totalPages: {
                  type: 'number',
                  description: '总页数',
                  example: 10,
                },
                hasNext: {
                  type: 'boolean',
                  description: '是否有下一页',
                  example: true,
                },
                hasPrevious: {
                  type: 'boolean',
                  description: '是否有上一页',
                  example: false,
                },
              },
              required: [
                'page',
                'pageSize',
                'total',
                'totalPages',
                'hasNext',
                'hasPrevious',
              ],
            },
          },
          required: ['items', 'meta'],
        },
        message: {
          type: 'string',
          description: '成功消息',
          example: description,
        },
        timestamp: {
          type: 'string',
          format: 'date-time',
          description: '响应时间戳',
          example: '2024-01-15T10:30:00Z',
        },
      },
      required: ['success', 'data', 'timestamp'],
    },
  };

  return applyDecorators(ApiResponse(responseOptions));
}

/**
 * 错误响应装饰器
 *
 * 用于装饰可能返回错误的端点
 *
 * @param options - 错误响应配置选项
 * @returns 装饰器函数
 *
 * @example
 * ```typescript
 * @ApiErrorResponses([
 *   { status: HttpStatus.BAD_REQUEST, description: '请求参数错误' },
 *   { status: HttpStatus.UNAUTHORIZED, description: '未授权访问' }
 * ])
 * async createUser() {
 *   // ...
 * }
 * ```
 */
export function ApiErrorResponses(options: ErrorResponseOptions[]) {
  const decorators = options.map(({ status, description }) =>
    ApiResponse({
      status,
      description,
      schema: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false,
            description: '请求失败标识',
          },
          error: {
            type: 'string',
            description: '错误消息',
            example: description,
          },
          details: {
            type: 'array',
            description: '错误详情列表',
            items: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: '错误代码',
                  example: 'VALIDATION_FAILED',
                },
                field: {
                  type: 'string',
                  description: '错误字段',
                  example: 'email',
                },
                message: {
                  type: 'string',
                  description: '错误描述',
                  example: '邮箱格式不正确',
                },
              },
              required: ['code', 'message'],
            },
          },
          errorCode: {
            type: 'string',
            description: '错误代码',
            example: 'VALIDATION_ERROR',
          },
          requestId: {
            type: 'string',
            description: '请求ID（用于追踪）',
            example: 'req-123456789',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: '响应时间戳',
            example: '2024-01-15T10:30:00Z',
          },
        },
        required: ['success', 'error', 'timestamp'],
      },
    }),
  );

  return applyDecorators(...decorators);
}

/**
 * 常用错误响应装饰器
 *
 * 预定义的常用错误响应，包括：
 * - 400 Bad Request
 * - 401 Unauthorized
 * - 403 Forbidden
 * - 404 Not Found
 * - 500 Internal Server Error
 *
 * @example
 * ```typescript
 * @ApiCommonErrorResponses()
 * async someEndpoint() {
 *   // ...
 * }
 * ```
 */
export function ApiCommonErrorResponses() {
  return ApiErrorResponses([
    { status: HttpStatus.BAD_REQUEST, description: '请求参数错误' },
    { status: HttpStatus.UNAUTHORIZED, description: '未授权访问' },
    { status: HttpStatus.FORBIDDEN, description: '禁止访问' },
    { status: HttpStatus.NOT_FOUND, description: '资源不存在' },
    {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      description: '服务器内部错误',
    },
  ]);
}