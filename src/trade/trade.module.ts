import { Module } from '@nestjs/common';
import { TradeController } from './trade.controller';
import { TradeService } from './trade.service';
import { ConfigService } from '../common/config.service';

@Module({
  controllers: [TradeController],
  providers: [TradeService, ConfigService],
})
export class TradeModule {}