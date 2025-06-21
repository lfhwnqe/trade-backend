import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { CommonModule } from './modules/common/common.module';
import { UserModule } from './modules/user/user.module';
import { TradeModule } from './modules/trade/trade.module';
import { AuthMiddleware } from './modules/common/auth.middleware';
import { ImageModule } from './modules/image/image.module';
import { RAGModule } from './modules/rag/rag.module';
import { ResponseInterceptor } from './base/interceptors/response.interceptor';
import { HttpExceptionFilter } from './base/filters/http-exception.filter';
import { ExampleModule } from './base/examples/example.module';
import { AUTH_WHITELIST } from './modules/common/auth.config';
@Module({
  imports: [
    CommonModule,
    UserModule,
    TradeModule,
    ImageModule,
    RAGModule,
    ExampleModule,
  ],
  providers: [
    // 全局响应拦截器
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    // 全局异常过滤器
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .exclude(...AUTH_WHITELIST)
      .forRoutes('*');
  }
}
