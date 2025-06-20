import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../interfaces/response.interface';

/**
 * 响应格式标准化拦截器
 *
 * 自动将控制器返回的数据封装为标准的 ApiResponse 格式。
 * 支持以下场景：
 * 1. 控制器直接返回数据 - 自动封装为标准格式
 * 2. 控制器返回已格式化的 ApiResponse - 保持不变
 * 3. 处理分页响应和错误响应
 */
@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  /**
   * 拦截响应并标准化格式
   *
   * @param context - 执行上下文
   * @param next - 调用处理器
   * @returns 标准化的响应数据
   */
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // 如果已经是标准格式的响应，直接返回
        if (this.isApiResponse(data)) {
          return data;
        }

        // 获取响应状态码
        const response = context.switchToHttp().getResponse();
        const statusCode = response.statusCode;

        // 根据状态码判断是否成功
        const success = statusCode >= 200 && statusCode < 300;

        // 封装为标准格式
        return {
          success,
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }

  /**
   * 检查数据是否已经是 ApiResponse 格式
   *
   * @param data - 待检查的数据
   * @returns 是否为 ApiResponse 格式
   */
  private isApiResponse(data: any): data is ApiResponse<T> {
    return (
      data &&
      typeof data === 'object' &&
      'success' in data &&
      'timestamp' in data &&
      typeof data.success === 'boolean'
    );
  }
}