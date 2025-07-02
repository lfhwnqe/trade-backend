/**
 * MindMap模块
 * 配置MindMap相关的控制器、服务和依赖
 */

import { Module } from '@nestjs/common';
import { MindMapController } from './mindmap.controller';
import { MindMapService } from './mindmap.service';

@Module({
  imports: [
    // TODO: 添加DynamoDB模块依赖
    // DynamoDBModule,
  ],
  controllers: [MindMapController],
  providers: [MindMapService],
  exports: [MindMapService], // 导出服务供其他模块使用
})
export class MindMapModule {}
