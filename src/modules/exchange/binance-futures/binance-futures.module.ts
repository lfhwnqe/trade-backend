import { Module } from '@nestjs/common';
import { BinanceFuturesController } from './binance-futures.controller';
import { BinanceFuturesService } from './binance-futures.service';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [BinanceFuturesController],
  providers: [BinanceFuturesService],
  exports: [BinanceFuturesService],
})
export class BinanceFuturesModule {}
