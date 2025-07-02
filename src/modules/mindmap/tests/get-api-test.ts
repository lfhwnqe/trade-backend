/**
 * 获取脑图API测试
 * 验证点：可以成功获取脑图数据
 */

import { MindMapService } from '../mindmap.service';
import { ConfigService } from '@nestjs/config';
import { MINDMAP_DEFAULTS } from '../types/mindmap.types';

// 模拟DynamoDB操作
const mockDynamoDBDocument = {
  put: async (params: any) => {
    console.log('🔧 模拟DynamoDB PUT操作:', {
      TableName: params.TableName,
      PK: params.Item.PK,
      SK: params.Item.SK,
      title: params.Item.title,
    });
    return { $metadata: { httpStatusCode: 200 } };
  },
  get: async (params: any) => {
    console.log('🔧 模拟DynamoDB GET操作:', params.Key);
    
    // 模拟返回存在的脑图数据
    if (params.Key.PK === 'USER#test-user-123' && params.Key.SK === 'MINDMAP#test-mindmap-123') {
      return {
        Item: {
          PK: 'USER#test-user-123',
          SK: 'MINDMAP#test-mindmap-123',
          id: 'test-mindmap-123',
          userId: 'test-user-123',
          title: '测试获取脑图',
          description: '这是一个用于测试获取功能的脑图',
          data: JSON.stringify({
            data: {
              text: '根节点',
              expand: true,
            },
            children: [
              {
                data: {
                  text: '子节点1',
                  expand: true,
                },
                children: []
              }
            ]
          }),
          layout: MINDMAP_DEFAULTS.LAYOUT,
          theme: MINDMAP_DEFAULTS.THEME,
          viewData: JSON.stringify({ scale: 1, translateX: 0, translateY: 0 }),
          tags: ['测试', '获取'],
          version: MINDMAP_DEFAULTS.VERSION,
          createdAt: '2025-07-02T13:00:00.000Z',
          updatedAt: '2025-07-02T13:30:00.000Z',
        }
      };
    }
    
    // 模拟不存在的脑图
    return { Item: null };
  },
  delete: async (params: any) => {
    console.log('🔧 模拟DynamoDB DELETE操作:', params.Key);
    return { $metadata: { httpStatusCode: 200 } };
  },
  query: async (params: any) => {
    console.log('🔧 模拟DynamoDB QUERY操作:', params.KeyConditionExpression);
    return { Items: [], Count: 0 };
  },
};

// 模拟ConfigService
const mockConfigService = {
  getOrThrow: (key: string) => {
    const config = {
      'AWS_REGION': 'us-east-1',
      'MINDMAP_TABLE_NAME': 'mindmap-test-table',
    };
    return config[key] || `mock-${key}`;
  },
  get: (key: string, defaultValue?: any) => {
    const config = {
      'AWS_REGION': 'us-east-1',
      'MINDMAP_TABLE_NAME': 'mindmap-test-table',
    };
    return config[key] || defaultValue;
  },
} as ConfigService;

async function testGetMindMapAPI() {
  console.log('🧪 开始测试获取脑图API...');
  
  try {
    // 创建服务实例
    const mindMapService = new MindMapService(mockConfigService);
    
    // 模拟DynamoDB客户端
    (mindMapService as any).db = mockDynamoDBDocument;
    
    // 测试1: 获取存在的脑图
    console.log('\n📝 测试1: 获取存在的脑图');
    const userId = 'test-user-123';
    const mindMapId = 'test-mindmap-123';
    
    console.log('用户ID:', userId);
    console.log('脑图ID:', mindMapId);
    
    // 调用获取API
    console.log('🚀 调用获取脑图API...');
    const result = await mindMapService.getMindMapById(userId, mindMapId);
    
    // 验证结果
    console.log('✅ 获取成功！');
    console.log('返回结果:');
    console.log('- ID:', result.id);
    console.log('- 标题:', result.title);
    console.log('- 描述:', result.description);
    console.log('- 布局:', result.layout);
    console.log('- 主题:', result.theme);
    console.log('- 版本:', result.metadata.version);
    console.log('- 创建时间:', result.metadata.createdAt);
    console.log('- 更新时间:', result.metadata.updatedAt);
    console.log('- 标签:', result.metadata.tags);
    console.log('- 数据节点数:', result.data ? 1 + (result.data.children?.length || 0) : 0);
    
    // 验证必要字段
    const validations = [
      { field: 'id', value: result.id, check: (v) => v === mindMapId },
      { field: 'userId', value: result.userId, check: (v) => v === userId },
      { field: 'title', value: result.title, check: (v) => v === '测试获取脑图' },
      { field: 'description', value: result.description, check: (v) => v === '这是一个用于测试获取功能的脑图' },
      { field: 'layout', value: result.layout, check: (v) => v === MINDMAP_DEFAULTS.LAYOUT },
      { field: 'theme', value: result.theme, check: (v) => v === MINDMAP_DEFAULTS.THEME },
      { field: 'version', value: result.metadata.version, check: (v) => v === MINDMAP_DEFAULTS.VERSION },
      { field: 'createdAt', value: result.metadata.createdAt, check: (v) => v === '2025-07-02T13:00:00.000Z' },
      { field: 'updatedAt', value: result.metadata.updatedAt, check: (v) => v === '2025-07-02T13:30:00.000Z' },
      { field: 'tags', value: result.metadata.tags, check: (v) => Array.isArray(v) && v.length === 2 },
      { field: 'data', value: result.data, check: (v) => v && v.data && v.data.text === '根节点' },
    ];
    
    let allValid = true;
    for (const validation of validations) {
      const isValid = validation.check(validation.value);
      if (isValid) {
        console.log(`✅ ${validation.field}: 验证通过`);
      } else {
        console.log(`❌ ${validation.field}: 验证失败`, validation.value);
        allValid = false;
      }
    }
    
    // 测试2: 获取不存在的脑图
    console.log('\n📝 测试2: 获取不存在的脑图');
    const nonExistentId = 'non-existent-mindmap';
    console.log('脑图ID:', nonExistentId);
    
    try {
      console.log('🚀 调用获取不存在脑图API...');
      await mindMapService.getMindMapById(userId, nonExistentId);
      console.log('❌ 应该抛出NotFoundException，但没有抛出');
      allValid = false;
    } catch (error) {
      if (error.name === 'NotFoundException') {
        console.log('✅ 正确抛出NotFoundException');
      } else {
        console.log('❌ 抛出了错误的异常类型:', error.name);
        allValid = false;
      }
    }
    
    if (allValid) {
      console.log('\n🎉 所有验证通过！获取脑图API功能正常');
      return true;
    } else {
      console.log('\n❌ 部分验证失败，请检查实现');
      return false;
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('错误详情:', error);
    return false;
  }
}

// 运行测试
if (require.main === module) {
  testGetMindMapAPI()
    .then(success => {
      console.log('\n📊 测试结果:', success ? '成功' : '失败');
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('测试执行错误:', error);
      process.exit(1);
    });
}

export { testGetMindMapAPI };
