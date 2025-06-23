import { Module } from '@nestjs/common';
import { RAGController } from './rag.controller';
import { RAGService } from './rag.service';
import { MetadataService } from './metadata.service';
import { TradeHistoryRAGService } from './trade-history-rag.service';
import { CacheService } from './utils/cache.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [RAGController],
  providers: [RAGService, MetadataService, TradeHistoryRAGService, CacheService],
  exports: [RAGService, MetadataService, TradeHistoryRAGService, CacheService],
})
export class RAGModule {}
