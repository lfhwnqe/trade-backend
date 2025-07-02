/**
 * 实体类测试文件
 * 用于验证实体类可以正常导入和实例化
 */

import { MindMapEntityClass } from '../entities/mindmap.entity';
import { MindMapData } from '../types/mindmap.types';

// 测试实体类导入和实例化
function testEntityImportAndInstantiation() {
  console.log('Testing MindMapEntityClass import and instantiation...');
  
  try {
    // 测试默认构造函数
    const entity1 = new MindMapEntityClass();
    console.log('✅ Default constructor works');
    
    // 测试带参数构造函数
    const entity2 = new MindMapEntityClass({
      userId: 'test-user-123',
      title: 'Test Mind Map',
      description: 'This is a test mind map',
    });
    console.log('✅ Parameterized constructor works');
    
    // 测试数据转换
    const mindMapData = entity2.toMindMapData();
    console.log('✅ toMindMapData() method works');
    
    // 测试从业务数据创建实体
    const entity3 = MindMapEntityClass.fromMindMapData(mindMapData);
    console.log('✅ fromMindMapData() static method works');
    
    // 测试验证方法
    const validation = entity2.validate();
    console.log('✅ validate() method works:', validation.isValid);
    
    // 测试更新方法
    entity2.update({ title: 'Updated Title' });
    console.log('✅ update() method works');
    
    // 测试DynamoDB项目转换
    const dynamoItem = entity2.toDynamoDBItem();
    console.log('✅ toDynamoDBItem() method works');
    
    console.log('🎉 All entity tests passed!');
    return true;
  } catch (error) {
    console.error('❌ Entity test failed:', error);
    return false;
  }
}

// 运行测试
testEntityImportAndInstantiation();
