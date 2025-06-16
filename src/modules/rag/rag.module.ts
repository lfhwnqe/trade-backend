import { Module } from '@nestjs/common';
import { RAGController } from './rag.controller';
import { RAGService } from './rag.service';
import { MetadataService } from './metadata.service';
import { CacheService } from './utils/cache.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [RAGController],
  providers: [RAGService, MetadataService, CacheService],
  exports: [RAGService, MetadataService, CacheService],
})
export class RAGModule {}
