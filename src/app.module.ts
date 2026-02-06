import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { CommonModule } from './modules/common/common.module';
import { UserModule } from './modules/user/user.module';
import { TradeModule } from './modules/trade/trade.module';
import { AuthMiddleware } from './modules/common/auth.middleware';
import { ImageModule } from './modules/image/image.module';
import { RoleModule } from './modules/role/role.module';
import { TelegramModule } from './modules/telegram/telegram.module';
// import { RAGModule } from './modules/rag/rag.module';

@Module({
  imports: [
    CommonModule,
    UserModule,
    TradeModule,
    ImageModule,
    RoleModule,
    TelegramModule,
    // RAGModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .exclude(
        '/user/login',
        '/user/register',
        '/user/confirm',
        '/svg-parser/parse',
        '/svg-parser/parse-string',
        '/svg-parser/parse-url',
        '/svg-parser/parse-file',
        '/svg-parser/validate',
        // Webhooks (must bypass cookie/api-token auth)
        '/webhook/telegram',
        '/webhook/trade-alert',
      )
      .forRoutes('*');
  }
}
