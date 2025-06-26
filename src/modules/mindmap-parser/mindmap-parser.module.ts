import { Module } from '@nestjs/common';
import { MindMapParserController } from './mindmap-parser.controller';
import { MindMapParserService } from './services/mindmap-parser.service';
import { GraphRepositoryService } from './services/graph-repository.service';

@Module({
  controllers: [MindMapParserController],
  providers: [MindMapParserService, GraphRepositoryService],
  exports: [MindMapParserService, GraphRepositoryService],
})
export class MindMapParserModule {}
