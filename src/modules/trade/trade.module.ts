import { Module } from '@nestjs/common';
import { TradeController } from './trade.controller';
import { TradeService } from './trade.service';
import { CommonModule } from '../common/common.module';
import { ImageService } from '../image/image.service';
// import { RAGModule } from '../rag/rag.module';

@Module({
  imports: [CommonModule],
  // imports: [CommonModule, RAGModule],
  controllers: [TradeController],
  providers: [TradeService, ImageService],
})
export class TradeModule {}
