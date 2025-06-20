import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ErrorResponse, ErrorDetail } from '../interfaces/response.interface';
import { v4 as uuidv4 } from 'uuid';

/**
 * HTTP 异常过滤器
 *
 * 统一处理应用中的异常，并返回标准化的错误响应格式。
 * 支持以下功能：
 * 1. 标准化错误响应格式
 * 2. 生成请求追踪ID
 * 3. 处理验证错误详情
 * 4. 记录错误日志
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  /**
   * 捕获并处理异常
   *
   * @param exception - 捕获的异常
   * @param host - 参数主机对象
   */
  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 获取HTTP状态码
    const status = this.getHttpStatus(exception);
    
    // 生成请求追踪ID
    const requestId = this.generateRequestId();
    
    // 构建错误响应
    const errorResponse = this.buildErrorResponse(
      exception,
      status,
      requestId,
    );

    // 记录错误日志
    this.logError(exception, request, status, requestId);

    // 返回错误响应
    response.status(status).json(errorResponse);
  }

  /**
   * 获取HTTP状态码
   *
   * @param exception - 异常对象
   * @returns HTTP状态码
   */
  private getHttpStatus(exception: Error): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  /**
   * 生成请求追踪ID
   *
   * @returns 请求追踪ID
   */
  private generateRequestId(): string {
    return `req-${uuidv4()}`;
  }

  /**
   * 构建标准化错误响应
   *
   * @param exception - 异常对象
   * @param status - HTTP状态码
   * @param requestId - 请求追踪ID
   * @returns 标准化错误响应
   */
  private buildErrorResponse(
    exception: Error,
    status: number,
    requestId: string,
  ): ErrorResponse {
    const errorResponse: ErrorResponse = {
      success: false,
      error: exception.message || '服务器内部错误',
      errorCode: this.getErrorCode(status),
      requestId,
      timestamp: new Date().toISOString(),
    };

    // 处理验证错误详情
    if (exception instanceof BadRequestException) {
      const validationDetails = this.extractValidationDetails(exception);
      if (validationDetails.length > 0) {
        errorResponse.details = validationDetails;
      }
    }

    return errorResponse;
  }

  /**
   * 根据HTTP状态码获取错误代码
   *
   * @param status - HTTP状态码
   * @returns 错误代码
   */
  private getErrorCode(status: number): string {
    const errorCodeMap: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.METHOD_NOT_ALLOWED]: 'METHOD_NOT_ALLOWED',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
      [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
      [HttpStatus.BAD_GATEWAY]: 'BAD_GATEWAY',
      [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
      [HttpStatus.GATEWAY_TIMEOUT]: 'GATEWAY_TIMEOUT',
    };

    return errorCodeMap[status] || 'UNKNOWN_ERROR';
  }

  /**
   * 提取验证错误详情
   *
   * @param exception - BadRequestException实例
   * @returns 错误详情数组
   */
  private extractValidationDetails(exception: BadRequestException): ErrorDetail[] {
    const response = exception.getResponse();
    
    if (typeof response === 'object' && response !== null) {
      const responseObj = response as any;
      
      // 处理class-validator的验证错误格式
      if (Array.isArray(responseObj.message)) {
        return responseObj.message.map((msg: any) => {
          if (typeof msg === 'string') {
            return {
              code: 'VALIDATION_FAILED',
              message: msg,
            };
          }
          
          if (typeof msg === 'object' && msg.constraints) {
            const field = msg.property || 'unknown';
            const constraint = Object.keys(msg.constraints)[0];
            const message = msg.constraints[constraint];
            
            return {
              code: constraint?.toUpperCase() || 'VALIDATION_FAILED',
              field,
              message,
            };
          }
          
          return {
            code: 'VALIDATION_FAILED',
            message: String(msg),
          };
        });
      }
    }
    
    return [];
  }

  /**
   * 记录错误日志
   *
   * @param exception - 异常对象
   * @param request - 请求对象
   * @param status - HTTP状态码
   * @param requestId - 请求追踪ID
   */
  private logError(
    exception: Error,
    request: Request,
    status: number,
    requestId: string,
  ): void {
    const logContext = {
      requestId,
      method: request.method,
      url: request.url,
      userAgent: request.get('User-Agent'),
      ip: request.ip,
      status,
      error: exception.message,
      stack: exception.stack,
    };

    if (status >= 500) {
      this.logger.error('服务器内部错误', exception.stack, logContext);
    } else if (status >= 400) {
      this.logger.warn('客户端错误', logContext);
    } else {
      this.logger.log('异常处理', logContext);
    }
  }
}
