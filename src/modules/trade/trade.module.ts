import { Module } from '@nestjs/common';
import { TradeController } from './trade.controller';
import { TradeService } from './trade.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [TradeController],
  providers: [TradeService],
})
export class TradeModule {}
