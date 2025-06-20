import { Module } from '@nestjs/common';
import { ExampleController } from './example.controller';

/**
 * 响应格式标准化示例模块
 * 
 * 提供演示响应格式标准化系统的示例端点。
 * 仅在开发环境中启用，生产环境应移除此模块。
 */
@Module({
  controllers: [ExampleController],
})
export class ExampleModule {}