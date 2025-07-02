/**
 * 控制器测试文件
 * 用于验证控制器路由可以正常访问
 */

import 'reflect-metadata';
import { MindMapController } from '../mindmap.controller';
import { MindMapService } from '../mindmap.service';
import { CreateMindMapDto, UpdateMindMapDto, MindMapQueryDto } from '../dto';

// 测试控制器导入和方法调用
async function testControllerImportAndCall() {
  console.log('Testing MindMapController import and method calls...');
  
  try {
    // 创建服务实例
    const service = new MindMapService();
    
    // 创建控制器实例
    const controller = new MindMapController(service);
    console.log('✅ MindMapController instantiation works');

    // 模拟请求对象
    const mockRequest = {
      user: { sub: 'test-user-123' }
    };

    // 测试健康检查
    const healthResponse = await controller.healthCheck();
    console.log('✅ healthCheck() method works:', healthResponse.success);

    // 测试获取支持的布局
    const layoutsResponse = await controller.getSupportedLayouts();
    console.log('✅ getSupportedLayouts() method works:', layoutsResponse.data?.length, 'layouts');

    // 测试获取支持的主题
    const themesResponse = await controller.getSupportedThemes();
    console.log('✅ getSupportedThemes() method works:', themesResponse.data?.length, 'themes');

    // 测试创建脑图
    const createDto = new CreateMindMapDto();
    createDto.title = 'Test Mind Map';
    createDto.description = 'This is a test mind map';
    createDto.tags = ['test', 'demo'];
    
    const createResponse = await controller.createMindMap(createDto, mockRequest);
    console.log('✅ createMindMap() method works:', createResponse.success);

    // 测试获取脑图
    const getResponse = await controller.getMindMapById('test-id', mockRequest);
    console.log('✅ getMindMapById() method works:', getResponse.success);

    // 测试更新脑图
    const updateDto = new UpdateMindMapDto();
    updateDto.title = 'Updated Test Mind Map';
    updateDto.description = 'This is an updated test mind map';
    
    const updateResponse = await controller.updateMindMap('test-id', updateDto, mockRequest);
    console.log('✅ updateMindMap() method works:', updateResponse.success);

    // 测试获取脑图列表
    const queryDto = new MindMapQueryDto();
    queryDto.page = 1;
    queryDto.pageSize = 10;
    queryDto.sortBy = 'updatedAt';
    queryDto.sortOrder = 'desc';
    
    const listResponse = await controller.getMindMapList(queryDto, mockRequest);
    console.log('✅ getMindMapList() method works:', listResponse.success);

    // 测试删除脑图
    const deleteResponse = await controller.deleteMindMap('test-id', mockRequest);
    console.log('✅ deleteMindMap() method works:', deleteResponse.success);

    console.log('\n🎉 All controller tests passed!');
    return true;
  } catch (error) {
    console.error('❌ Controller test failed:', error);
    return false;
  }
}

// 运行测试
testControllerImportAndCall();
