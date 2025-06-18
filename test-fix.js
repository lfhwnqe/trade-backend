/**
 * 临时测试脚本 - 验证 DynamoDB 查询修复
 * 运行此脚本来验证修复是否有效
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

// 模拟配置
const testConfig = {
  region: 'us-east-1',
  tableName: 'rag-documents-dev', // 根据实际环境调整
};

const dynamoDBClient = new DynamoDBClient({ region: testConfig.region });
const docClient = DynamoDBDocumentClient.from(dynamoDBClient);

async function testListDocumentsQuery() {
  console.log('🧪 测试 listDocuments GSI 查询...');
  
  const testUserId = 'test-user-123';
  
  try {
    // 测试使用 GSI 的查询（修复后）
    const params = {
      TableName: testConfig.tableName,
      IndexName: 'userId-createdAt-index',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': testUserId,
      },
    };
    
    console.log('📋 查询参数:', JSON.stringify(params, null, 2));
    
    const result = await docClient.send(new QueryCommand(params));
    
    console.log('✅ 查询成功!');
    console.log(`📊 找到 ${result.Items?.length || 0} 个文档`);
    
    if (result.Items && result.Items.length > 0) {
      console.log('📄 示例文档结构:', JSON.stringify(result.Items[0], null, 2));
    }
    
    return true;
  } catch (error) {
    console.error('❌ 查询失败:', error.message);
    
    if (error.message.includes('ValidationException')) {
      console.log('🔍 这可能是表结构问题或 GSI 不存在');
    }
    
    return false;
  }
}

async function testGetDocumentById() {
  console.log('\n🧪 测试 getDocument 主键查询...');
  
  const testDocumentId = 'test-doc-123';
  
  try {
    const params = {
      TableName: testConfig.tableName,
      Key: { id: testDocumentId },
    };
    
    console.log('📋 查询参数:', JSON.stringify(params, null, 2));
    
    const result = await docClient.send(new GetCommand(params));
    
    if (result.Item) {
      console.log('✅ 文档查询成功!');
      console.log('📄 文档结构:', JSON.stringify(result.Item, null, 2));
    } else {
      console.log('⚠️  文档不存在（这是正常的，因为这是测试ID）');
    }
    
    return true;
  } catch (error) {
    console.error('❌ 查询失败:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 开始 DynamoDB 查询修复验证\n');
  
  const test1Success = await testListDocumentsQuery();
  const test2Success = await testGetDocumentById();
  
  console.log('\n📊 测试结果总结:');
  console.log(`- listDocuments GSI 查询: ${test1Success ? '✅ 成功' : '❌ 失败'}`);
  console.log(`- getDocument 主键查询: ${test2Success ? '✅ 成功' : '❌ 失败'}`);
  
  if (test1Success && test2Success) {
    console.log('\n🎉 所有测试通过! DynamoDB 查询修复成功。');
  } else {
    console.log('\n⚠️  部分测试失败，可能需要进一步调试。');
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testListDocumentsQuery, testGetDocumentById };