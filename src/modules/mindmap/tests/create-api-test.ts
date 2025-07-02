/**
 * 创建脑图API测试
 * 验证点：可以成功创建脑图记录
 */

import { MindMapService } from '../mindmap.service';
import { ConfigService } from '@nestjs/config';
import { CreateMindMapRequest, MINDMAP_DEFAULTS } from '../types/mindmap.types';

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

async function testCreateMindMapAPI() {
  console.log('🧪 开始测试创建脑图API...');

  try {
    // 创建服务实例
    const mindMapService = new MindMapService(mockConfigService);

    // 模拟DynamoDB客户端
    (mindMapService as any).db = mockDynamoDBDocument;
    
    // 准备测试数据
    const userId = 'test-user-123';
    const createData: CreateMindMapRequest = {
      title: '测试脑图',
      description: '这是一个测试脑图',
      data: {
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
          },
          {
            data: {
              text: '子节点2',
              expand: true,
            },
            children: []
          }
        ]
      },
      layout: MINDMAP_DEFAULTS.LAYOUT,
      theme: MINDMAP_DEFAULTS.THEME,
      tags: ['测试', 'API'],
    };
    
    console.log('📝 测试数据准备完成');
    console.log('用户ID:', userId);
    console.log('脑图标题:', createData.title);
    console.log('脑图描述:', createData.description);
    console.log('标签:', createData.tags);
    
    // 调用创建API
    console.log('🚀 调用创建脑图API...');
    const result = await mindMapService.createMindMap(userId, createData);
    
    // 验证结果
    console.log('✅ 创建成功！');
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
      { field: 'id', value: result.id, check: (v) => v && typeof v === 'string' },
      { field: 'title', value: result.title, check: (v) => v === createData.title },
      { field: 'description', value: result.description, check: (v) => v === createData.description },
      { field: 'layout', value: result.layout, check: (v) => v === createData.layout },
      { field: 'theme', value: result.theme, check: (v) => v === createData.theme },
      { field: 'version', value: result.metadata.version, check: (v) => v === MINDMAP_DEFAULTS.VERSION },
      { field: 'createdAt', value: result.metadata.createdAt, check: (v) => v && typeof v === 'string' },
      { field: 'updatedAt', value: result.metadata.updatedAt, check: (v) => v && typeof v === 'string' },
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
    
    if (allValid) {
      console.log('\n🎉 所有验证通过！创建脑图API功能正常');
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
  testCreateMindMapAPI()
    .then(success => {
      console.log('\n📊 测试结果:', success ? '成功' : '失败');
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('测试执行错误:', error);
      process.exit(1);
    });
}

export { testCreateMindMapAPI };
