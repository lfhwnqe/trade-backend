import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { SVGParserException } from '../exceptions/svg-parser.exceptions';

@Catch(SVGParserException, HttpException, Error)
export class SVGParserExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SVGParserExceptionFilter.name);

  catch(
    exception: SVGParserException | HttpException | Error,
    host: ArgumentsHost,
  ) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let errorResponse: any;

    if (exception instanceof SVGParserException) {
      // 处理SVG解析器特定异常
      status = exception.getStatus();
      errorResponse = {
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        error: exception.getResponse(),
        requestId: this.generateRequestId(),
      };

      this.logger.error(
        `SVG解析异常 [${exception.code}]: ${exception.message}`,
        exception.stack,
      );
    } else if (exception instanceof HttpException) {
      // 处理HTTP异常
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      errorResponse = {
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        error:
          typeof exceptionResponse === 'string'
            ? { message: exceptionResponse }
            : exceptionResponse,
        requestId: this.generateRequestId(),
      };

      this.logger.error(
        `HTTP异常 [${status}]: ${exception.message}`,
        exception.stack,
      );
    } else {
      // 处理未知异常
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorResponse = {
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_ERROR',
        },
        requestId: this.generateRequestId(),
      };

      this.logger.error(`未知异常: ${exception.message}`, exception.stack);
    }

    // 记录请求信息
    this.logRequestInfo(request, status);

    // 发送响应
    response.status(status).json(errorResponse);
  }

  /**
   * 记录请求信息
   */
  private logRequestInfo(request: Request, status: number): void {
    const { method, url, headers, body, query } = request;

    this.logger.error(`请求失败 ${method} ${url} - ${status}`, {
      headers: this.sanitizeHeaders(headers),
      body: this.sanitizeBody(body),
      query,
      userAgent: headers['user-agent'],
      ip: request.ip,
    });
  }

  /**
   * 清理敏感头信息
   */
  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];

    sensitiveHeaders.forEach((header) => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * 清理敏感请求体信息
   */
  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret'];

    sensitiveFields.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    // 如果SVG内容过长，截断显示
    if (sanitized.svgContent && sanitized.svgContent.length > 1000) {
      sanitized.svgContent =
        sanitized.svgContent.substring(0, 1000) + '...[TRUNCATED]';
    }

    return sanitized;
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
