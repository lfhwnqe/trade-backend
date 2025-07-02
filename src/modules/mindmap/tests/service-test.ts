/**
 * 服务类测试文件
 * 用于验证服务类可以正常注入和调用
 */

import 'reflect-metadata';
import { MindMapService } from '../mindmap.service';

// 测试服务类导入和调用
async function testServiceImportAndCall() {
  console.log('Testing MindMapService import and method calls...');
  
  try {
    // 测试服务类实例化
    const service = new MindMapService();
    console.log('✅ MindMapService instantiation works');

    // 测试健康状态检查
    const healthStatus = await service.getHealthStatus();
    console.log('✅ getHealthStatus() method works:', healthStatus.status);

    // 测试创建脑图
    const createData = {
      title: 'Test Mind Map',
      description: 'This is a test mind map',
      tags: ['test', 'demo']
    };
    
    const createdMindMap = await service.createMindMap('test-user-123', createData);
    console.log('✅ createMindMap() method works, created ID:', createdMindMap.id);

    // 测试获取脑图
    const retrievedMindMap = await service.getMindMapById('test-user-123', 'test-id');
    console.log('✅ getMindMapById() method works, retrieved ID:', retrievedMindMap.id);

    // 测试更新脑图
    const updateData = {
      title: 'Updated Test Mind Map',
      description: 'This is an updated test mind map'
    };
    
    const updatedMindMap = await service.updateMindMap('test-user-123', 'test-id', updateData);
    console.log('✅ updateMindMap() method works, updated title:', updatedMindMap.title);

    // 测试获取脑图列表
    const queryParams = {
      page: 1,
      pageSize: 10,
      sortBy: 'updatedAt' as const,
      sortOrder: 'desc' as const
    };
    
    const mindMapList = await service.getMindMapList('test-user-123', queryParams);
    console.log('✅ getMindMapList() method works, found items:', mindMapList.items.length);

    // 测试权限检查
    const hasPermission = await service.checkPermission('test-user-123', 'test-id');
    console.log('✅ checkPermission() method works, has permission:', hasPermission);

    // 测试删除脑图
    await service.deleteMindMap('test-user-123', 'test-id');
    console.log('✅ deleteMindMap() method works');

    console.log('\n🎉 All service tests passed!');
    return true;
  } catch (error) {
    console.error('❌ Service test failed:', error);
    return false;
  }
}

// 运行测试
testServiceImportAndCall();
