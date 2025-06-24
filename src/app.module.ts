import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { CommonModule } from './modules/common/common.module';
import { UserModule } from './modules/user/user.module';
import { TradeModule } from './modules/trade/trade.module';
import { AuthMiddleware } from './modules/common/auth.middleware';
import { ImageModule } from './modules/image/image.module';
import { RAGModule } from './modules/rag/rag.module';
import { SVGParserModule } from './modules/svg-parser/svg-parser.module';

@Module({
  imports: [
    CommonModule,
    UserModule,
    TradeModule,
    ImageModule,
    RAGModule,
    SVGParserModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .exclude('/user/login', '/user/register', '/user/confirm')
      .forRoutes('*');
  }
}
