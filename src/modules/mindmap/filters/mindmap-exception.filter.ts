/**
 * MindMap模块异常过滤器
 * 统一处理MindMap相关的异常
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ErrorResponseDto } from '../dto';

@Catch()
export class MindMapExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(MindMapExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorCode = 'INTERNAL_ERROR';

    // 处理HTTP异常
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        message = (exceptionResponse as any).message || exception.message;
      }

      // 根据异常类型设置错误代码
      switch (exception.constructor.name) {
        case 'NotFoundException':
          errorCode = 'NOT_FOUND';
          break;
        case 'BadRequestException':
          errorCode = 'BAD_REQUEST';
          break;
        case 'UnauthorizedException':
          errorCode = 'UNAUTHORIZED';
          break;
        case 'ForbiddenException':
          errorCode = 'FORBIDDEN';
          break;
        case 'ConflictException':
          errorCode = 'CONFLICT';
          break;
        default:
          errorCode = 'HTTP_ERROR';
      }
    }
    // 处理DynamoDB异常
    else if (exception && typeof exception === 'object' && 'name' in exception) {
      const error = exception as any;
      
      switch (error.name) {
        case 'ResourceNotFoundException':
          status = HttpStatus.NOT_FOUND;
          message = 'Resource not found';
          errorCode = 'RESOURCE_NOT_FOUND';
          break;
        case 'ConditionalCheckFailedException':
          status = HttpStatus.CONFLICT;
          message = 'Resource already exists or condition failed';
          errorCode = 'CONDITION_FAILED';
          break;
        case 'ValidationException':
          status = HttpStatus.BAD_REQUEST;
          message = 'Invalid request parameters';
          errorCode = 'VALIDATION_ERROR';
          break;
        case 'ProvisionedThroughputExceededException':
          status = HttpStatus.TOO_MANY_REQUESTS;
          message = 'Request rate too high, please try again later';
          errorCode = 'RATE_LIMIT_EXCEEDED';
          break;
        case 'ServiceUnavailableException':
          status = HttpStatus.SERVICE_UNAVAILABLE;
          message = 'Service temporarily unavailable';
          errorCode = 'SERVICE_UNAVAILABLE';
          break;
        default:
          message = error.message || 'Unknown error occurred';
          errorCode = 'UNKNOWN_ERROR';
      }
    }
    // 处理其他异常
    else if (exception instanceof Error) {
      message = exception.message;
      errorCode = 'APPLICATION_ERROR';
    }

    // 记录错误日志
    this.logger.error(
      `${request.method} ${request.url} - ${status} ${message}`,
      exception instanceof Error ? exception.stack : String(exception)
    );

    // 创建统一的错误响应
    const errorResponse = ErrorResponseDto.create(message, errorCode);

    // 添加调试信息（仅在开发环境）
    if (process.env.NODE_ENV === 'development') {
      (errorResponse as any).debug = {
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        stack: exception instanceof Error ? exception.stack : undefined,
      };
    }

    response.status(status).json(errorResponse);
  }
}
