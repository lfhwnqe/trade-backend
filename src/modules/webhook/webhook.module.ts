import { Module, forwardRef } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { TelegramModule } from '../telegram/telegram.module';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  imports: [CommonModule, forwardRef(() => TelegramModule)],
  controllers: [WebhookController],
  providers: [WebhookService],
  exports: [WebhookService],
})
export class WebhookModule {}
