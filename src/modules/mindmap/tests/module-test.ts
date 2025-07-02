/**
 * 模块测试文件
 * 用于验证模块可以正常启动
 */

import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { MindMapModule } from '../mindmap.module';
import { MindMapController } from '../mindmap.controller';
import { MindMapService } from '../mindmap.service';

// 测试模块导入和启动
async function testModuleImportAndBootstrap() {
  console.log('Testing MindMapModule import and bootstrap...');
  
  try {
    // 创建测试模块
    const module: TestingModule = await Test.createTestingModule({
      imports: [MindMapModule],
    }).compile();

    console.log('✅ MindMapModule compilation works');

    // 测试控制器注入
    const controller = module.get<MindMapController>(MindMapController);
    console.log('✅ MindMapController injection works:', !!controller);

    // 测试服务注入
    const service = module.get<MindMapService>(MindMapService);
    console.log('✅ MindMapService injection works:', !!service);

    // 测试服务方法调用
    const healthStatus = await service.getHealthStatus();
    console.log('✅ Service method call works:', healthStatus.status);

    // 测试控制器方法调用
    const healthResponse = await controller.healthCheck();
    console.log('✅ Controller method call works:', healthResponse.success);

    // 关闭模块
    await module.close();
    console.log('✅ Module close works');

    console.log('\n🎉 All module tests passed!');
    return true;
  } catch (error) {
    console.error('❌ Module test failed:', error);
    return false;
  }
}

// 运行测试
testModuleImportAndBootstrap();
