import { Module } from '@nestjs/common';
import { TradeController } from './trade.controller';
import { TradeService } from './trade.service';
import { CommonModule } from '../common/common.module';
import { RAGModule } from '../rag/rag.module';

@Module({
  imports: [CommonModule, RAGModule],
  controllers: [TradeController],
  providers: [TradeService],
})
export class TradeModule {}
