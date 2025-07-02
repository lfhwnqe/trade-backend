/**
 * 脑图响应DTO
 */

import { 
  ApiResponse, 
  PaginatedResponse, 
  MindMapData, 
  MindMapListItem 
} from '../types/mindmap.types';

/**
 * 单个脑图响应DTO
 */
export class MindMapResponseDto implements ApiResponse<MindMapData> {
  success: boolean;
  data?: MindMapData;
  message?: string;
  timestamp: string;

  constructor(data?: MindMapData, message?: string) {
    this.success = !!data;
    this.data = data;
    this.message = message;
    this.timestamp = new Date().toISOString();
  }

  static success(data: MindMapData, message?: string): MindMapResponseDto {
    return new MindMapResponseDto(data, message);
  }

  static error(message: string): MindMapResponseDto {
    return new MindMapResponseDto(undefined, message);
  }
}

/**
 * 脑图列表响应DTO
 */
export class MindMapListResponseDto implements PaginatedResponse<MindMapListItem> {
  success: boolean;
  data: {
    items: MindMapListItem[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
  message?: string;
  timestamp: string;

  constructor(
    items: MindMapListItem[] = [],
    total: number = 0,
    page: number = 1,
    pageSize: number = 20,
    message?: string
  ) {
    this.success = true;
    this.data = {
      items,
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total
    };
    this.message = message;
    this.timestamp = new Date().toISOString();
  }

  static success(
    items: MindMapListItem[],
    total: number,
    page: number,
    pageSize: number,
    message?: string
  ): MindMapListResponseDto {
    return new MindMapListResponseDto(items, total, page, pageSize, message);
  }

  static error(message: string): MindMapListResponseDto {
    const response = new MindMapListResponseDto();
    response.success = false;
    response.message = message;
    return response;
  }
}

/**
 * 通用成功响应DTO
 */
export class SuccessResponseDto implements ApiResponse<any> {
  success: boolean = true;
  data?: any;
  message?: string;
  timestamp: string;

  constructor(data?: any, message?: string) {
    this.data = data;
    this.message = message;
    this.timestamp = new Date().toISOString();
  }

  static create(data?: any, message?: string): SuccessResponseDto {
    return new SuccessResponseDto(data, message);
  }
}

/**
 * 通用错误响应DTO
 */
export class ErrorResponseDto implements ApiResponse<any> {
  success: boolean = false;
  data?: any;
  message?: string;
  timestamp: string;

  constructor(message?: string, data?: any) {
    this.message = message;
    this.data = data;
    this.timestamp = new Date().toISOString();
  }

  static create(message?: string, data?: any): ErrorResponseDto {
    return new ErrorResponseDto(message, data);
  }
}
