/**
 * MindMap模块
 * 配置MindMap相关的控制器、服务和依赖
 */

import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { CommonModule } from '../common/common.module';
import { MindMapController } from './mindmap.controller';
import { MindMapService } from './mindmap.service';
import { MindMapExceptionFilter } from './filters/mindmap-exception.filter';

@Module({
  imports: [
    CommonModule,
    // TODO: 添加DynamoDB模块依赖
    // DynamoDBModule,
  ],
  controllers: [MindMapController],
  providers: [
    MindMapService,
    {
      provide: APP_FILTER,
      useClass: MindMapExceptionFilter,
    },
  ],
  exports: [MindMapService], // 导出服务供其他模块使用
})
export class MindMapModule {}
