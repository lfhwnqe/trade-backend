/**
 * 应用启动测试文件
 * 用于验证模块可以正常启动
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { MindMapModule } from '../mindmap.module';

// 创建一个简单的测试应用模块
@Module({
  imports: [MindMapModule],
})
class TestAppModule {}

// 测试应用启动
async function testAppStartup() {
  console.log('Testing application startup with MindMapModule...');

  try {
    // 创建应用实例
    const app = await NestFactory.create(TestAppModule, {
      logger: false, // 禁用日志以减少输出
    });

    console.log('✅ Application created successfully');

    // 测试应用初始化
    await app.init();
    console.log('✅ Application initialized successfully');

    // 获取HTTP适配器
    const httpAdapter = app.getHttpAdapter();
    console.log('✅ HTTP adapter retrieved successfully');

    // 关闭应用
    await app.close();
    console.log('✅ Application closed successfully');

    console.log('\n🎉 Application startup test passed!');
    console.log('✅ MindMapModule is properly registered and can start normally');
    return true;
  } catch (error) {
    console.error('❌ Application startup test failed:', error.message);
    console.error('Stack trace:', error.stack);
    return false;
  }
}

// 运行测试
testAppStartup();
