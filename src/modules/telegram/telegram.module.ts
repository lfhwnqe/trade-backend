import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';

@Module({
  imports: [CommonModule],
  controllers: [TelegramController],
  providers: [TelegramService],
})
export class TelegramModule {}
