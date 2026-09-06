import { BridgeModule } from './modules/bridge/bridge.module';
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { CommonModule } from './modules/common/common.module';
import { UserModule } from './modules/user/user.module';
import { TradeModule } from './modules/trade/trade.module';
import { AuthMiddleware } from './modules/common/auth.middleware';
import { ImageModule } from './modules/image/image.module';
import { RoleModule } from './modules/role/role.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { BinanceFuturesModule } from './modules/exchange/binance-futures/binance-futures.module';
import { FlashcardModule } from './modules/flashcard/flashcard.module';
import { TradeFlashcardModule } from './modules/trade-flashcard/trade-flashcard.module';
import { DictionaryModule } from './modules/dictionary/dictionary.module';
import { MistakeModule } from './modules/mistake/mistake.module';
import { PracticalFlashcardModule } from './modules/practical-flashcard/practical-flashcard.module';
import { ImageRecognitionFlashcardModule } from './modules/image-recognition-flashcard/image-recognition-flashcard.module';
import { TradingViewTrainingRecordModule } from './modules/tradingview-training-record/tradingview-training-record.module';
import { PlaybookTemplateModule } from './modules/playbook-template/playbook-template.module';
// import { RAGModule } from './modules/rag/rag.module';

@Module({
  imports: [
    CommonModule,
    BridgeModule,
    UserModule,
    TradeModule,
    ImageModule,
    RoleModule,
    TelegramModule,
    WebhookModule,
    BinanceFuturesModule,
    FlashcardModule,
    TradeFlashcardModule,
    DictionaryModule,
    MistakeModule,
    PracticalFlashcardModule,
    ImageRecognitionFlashcardModule,
    TradingViewTrainingRecordModule,
    PlaybookTemplateModule,
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
        '/webhook/bridge/:triggerToken',
        // TradingView-friendly endpoints (no auth)
        '/webhook/trade-alert',
        '/webhook/trade-alert/:triggerToken',
        '/webhook/trade-alert/:triggerToken/:tradeShortId',
      )
      .forRoutes('*');
  }
}
