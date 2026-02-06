import { Module, forwardRef } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { WebhookModule } from '../webhook/webhook.module';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';

@Module({
  imports: [CommonModule, forwardRef(() => WebhookModule)],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
