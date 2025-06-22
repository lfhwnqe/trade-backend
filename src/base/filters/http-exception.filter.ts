import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ApiResponse, ErrorType } from '../interfaces/response.interface';
import { BaseCustomException } from '../exceptions/custom.exceptions';
import { ERROR_CODES } from '../constants/error-codes';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, errorResponse } = this.handleException(exception, request);

    // 记录错误日志
    this.logError(exception, request, status);

    response.status(status).json(errorResponse);
  }

  private handleException(exception: Error, request: Request) {
    let status: number;
    let errorResponse: ApiResponse;

    if (exception instanceof BaseCustomException) {
      // 处理自定义异常
      status = exception.getStatus();
      errorResponse = {
        success: false,
        error: exception.userMessage || exception.message,
        errorCode: exception.errorCode,
        errorType: exception.errorType,
        timestamp: new Date().toISOString(),
      };
    } else if (exception instanceof BadRequestException) {
      // 处理验证异常
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;
      
      errorResponse = {
        success: false,
        error: this.formatValidationError(exceptionResponse),
        errorCode: ERROR_CODES.VALIDATION_REQUIRED_FIELD,
        errorType: ErrorType.VALIDATION,
        timestamp: new Date().toISOString(),
      };
    } else if (exception instanceof HttpException) {
      // 处理其他 HTTP 异常
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;
      
      errorResponse = {
        success: false,
        error: typeof exceptionResponse === 'string'
          ? exceptionResponse
          : exceptionResponse.message || exception.message,
        errorCode: this.getErrorCodeByStatus(status),
        errorType: this.getErrorTypeByStatus(status),
        timestamp: new Date().toISOString(),
      };
    } else {
      // 处理系统异常
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      
      // 检查是否是特定的系统异常
      if (this.isCognitoError(exception)) {
        errorResponse = {
          success: false,
          error: '认证服务异常，请稍后重试',
          errorCode: ERROR_CODES.COGNITO_VERIFICATION_FAILED,
          errorType: ErrorType.COGNITO,
          timestamp: new Date().toISOString(),
        };
      } else if (this.isDynamoDBError(exception)) {
        errorResponse = {
          success: false,
          error: '数据库操作异常，请稍后重试',
          errorCode: ERROR_CODES.DYNAMODB_CONNECTION_ERROR,
          errorType: ErrorType.DYNAMODB,
          timestamp: new Date().toISOString(),
        };
      } else {
        errorResponse = {
          success: false,
          error: '系统内部错误，请稍后重试',
          errorCode: ERROR_CODES.SYSTEM_INTERNAL_ERROR,
          errorType: ErrorType.SYSTEM,
          timestamp: new Date().toISOString(),
        };
      }
    }

    return { status, errorResponse };
  }

  private formatValidationError(exceptionResponse: any): string {
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    if (exceptionResponse.message) {
      if (Array.isArray(exceptionResponse.message)) {
        return exceptionResponse.message.join('; ');
      }
      return exceptionResponse.message;
    }

    return '请求参数验证失败';
  }

  private getErrorCodeByStatus(status: number): string {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return ERROR_CODES.AUTH_UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ERROR_CODES.RESOURCE_ACCESS_DENIED;
      case HttpStatus.NOT_FOUND:
        return ERROR_CODES.RESOURCE_NOT_FOUND;
      case HttpStatus.BAD_REQUEST:
        return ERROR_CODES.VALIDATION_INVALID_VALUE;
      default:
        return ERROR_CODES.SYSTEM_INTERNAL_ERROR;
    }
  }

  private getErrorTypeByStatus(status: number): ErrorType {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return ErrorType.AUTHENTICATION;
      case HttpStatus.FORBIDDEN:
        return ErrorType.AUTHORIZATION;
      case HttpStatus.NOT_FOUND:
        return ErrorType.NOT_FOUND;
      case HttpStatus.BAD_REQUEST:
        return ErrorType.VALIDATION;
      default:
        return ErrorType.SYSTEM;
    }
  }

  private isCognitoError(exception: Error): boolean {
    const message = exception.message?.toLowerCase() || '';
    return message.includes('cognito') ||
           message.includes('jwt') ||
           message.includes('token') ||
           message.includes('Token 校验失败');
  }

  private isDynamoDBError(exception: Error): boolean {
    const message = exception.message?.toLowerCase() || '';
    const stack = exception.stack?.toLowerCase() || '';
    
    return message.includes('dynamodb') ||
           stack.includes('dynamodb') ||
           message.includes('aws-sdk') ||
           message.includes('resourcenotfound');
  }

  private logError(exception: Error, request: Request, status: number) {
    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'] || '';
    
    const logData = {
      timestamp: new Date().toISOString(),
      method,
      url,
      ip,
      userAgent,
      status,
      error: exception.message,
      stack: exception.stack,
    };

    if (status >= 500) {
      this.logger.error(`Internal Server Error: ${exception.message}`, logData);
    } else {
      this.logger.warn(`Client Error: ${exception.message}`, logData);
    }
  }
}
