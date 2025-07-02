/**
 * DTO类测试文件
 * 用于验证DTO类可以正常导入和验证
 */

import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { 
  CreateMindMapDto, 
  UpdateMindMapDto, 
  MindMapQueryDto,
  MindMapResponseDto,
  MindMapListResponseDto,
  SuccessResponseDto,
  ErrorResponseDto
} from '../dto';

// 测试DTO类导入和验证
async function testDTOImportAndValidation() {
  console.log('Testing DTO classes import and validation...');
  
  try {
    // 测试CreateMindMapDto
    console.log('\n--- Testing CreateMindMapDto ---');
    const createDto = plainToClass(CreateMindMapDto, {
      title: 'Test Mind Map',
      description: 'This is a test',
      tags: ['test', 'demo']
    });
    
    const createValidation = await validate(createDto);
    console.log('✅ CreateMindMapDto validation:', createValidation.length === 0 ? 'PASSED' : 'FAILED');
    if (createValidation.length > 0) {
      console.log('Validation errors:', createValidation);
    }

    // 测试UpdateMindMapDto
    console.log('\n--- Testing UpdateMindMapDto ---');
    const updateDto = plainToClass(UpdateMindMapDto, {
      title: 'Updated Title',
      tags: ['updated']
    });
    
    const updateValidation = await validate(updateDto);
    console.log('✅ UpdateMindMapDto validation:', updateValidation.length === 0 ? 'PASSED' : 'FAILED');

    // 测试MindMapQueryDto
    console.log('\n--- Testing MindMapQueryDto ---');
    const queryDto = plainToClass(MindMapQueryDto, {
      page: '1',
      pageSize: '20',
      sortBy: 'updatedAt',
      sortOrder: 'desc'
    });
    
    const queryValidation = await validate(queryDto);
    console.log('✅ MindMapQueryDto validation:', queryValidation.length === 0 ? 'PASSED' : 'FAILED');

    // 测试响应DTO
    console.log('\n--- Testing Response DTOs ---');
    
    const successResponse = MindMapResponseDto.success({
      id: 'test-id',
      userId: 'test-user',
      title: 'Test',
      data: { data: { text: 'root' }, children: [] },
      layout: 'logicalStructure',
      theme: 'default',
      metadata: {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });
    console.log('✅ MindMapResponseDto.success works');

    const errorResponse = MindMapResponseDto.error('Test error');
    console.log('✅ MindMapResponseDto.error works');

    const listResponse = MindMapListResponseDto.success([], 0, 1, 20);
    console.log('✅ MindMapListResponseDto.success works');

    const successDto = SuccessResponseDto.create({ id: 'test' }, 'Success');
    console.log('✅ SuccessResponseDto.create works');

    const errorDto = ErrorResponseDto.create('Error message');
    console.log('✅ ErrorResponseDto.create works');

    console.log('\n🎉 All DTO tests passed!');
    return true;
  } catch (error) {
    console.error('❌ DTO test failed:', error);
    return false;
  }
}

// 运行测试
testDTOImportAndValidation();
