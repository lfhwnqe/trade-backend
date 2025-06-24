import {
  IsString,
  IsEnum,
  IsNumber,
  IsArray,
  IsOptional,
  IsBoolean,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { DocumentType, Priority } from '../types/rag.types';

export class DateRangeDto {
  @ApiProperty({
    description: '开始时间',
    example: '2024-01-01T00:00:00Z',
  })
  @IsString()
  from: string;

  @ApiProperty({
    description: '结束时间',
    example: '2024-12-31T23:59:59Z',
  })
  @IsString()
  to: string;
}
export class DocumentMetadataDto {
  constructor() {
    console.log('[DEBUG] DocumentMetadataDto 构造函数被调用');
  }
  @ApiProperty({
    description: '文档来源',
    example: '交易策略研究报告',
    required: false,
  })
  @IsString()
  @IsOptional()
  source?: string;

  @ApiProperty({
    description: '作者',
    example: '张三',
    required: false,
  })
  @IsString()
  @IsOptional()
  author?: string;

  @ApiProperty({
    description: '标签列表',
    example: ['以太坊', '交易策略', '技术分析'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiProperty({
    description: '分类',
    example: '技术分析',
    required: false,
  })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({
    description: '优先级',
    enum: Priority,
    example: Priority.MEDIUM,
    required: false,
  })
  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @ApiProperty({
    description: '是否公开',
    example: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @ApiProperty({
    description: '交易品种（交易相关文档）',
    example: 'ETH',
    required: false,
  })
  @IsString()
  @IsOptional()
  tradeSymbol?: string;

  @ApiProperty({
    description: '时间范围',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => DateRangeDto)
  dateRange?: DateRangeDto;
}

// 添加调试日志以验证模块加载顺序
console.log('[DEBUG] create-document.dto.ts 模块正在加载...');

export class CreateDocumentDto {
  @ApiProperty({
    description: '文档标题',
    example: '以太坊交易策略分析',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: '文档类型',
    enum: DocumentType,
    example: DocumentType.KNOWLEDGE,
  })
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiProperty({
    description: '文档内容（文本形式）',
    example: '这是一份关于以太坊交易策略的详细分析文档...',
  })
  @IsString()
  content: string;

  @ApiProperty({
    description: '内容类型',
    example: 'text/plain',
  })
  @IsString()
  contentType: string;

  @ApiProperty({
    description: '原始文件名',
    example: 'eth-trading-strategy.md',
    required: false,
  })
  @IsString()
  @IsOptional()
  originalFileName?: string;

  @ApiProperty({
    description: '文件大小（字节）',
    example: 2048,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  fileSize?: number;

  @ApiProperty({
    description: '文档元数据',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => DocumentMetadataDto)
  metadata?: DocumentMetadataDto;
}

console.log('[DEBUG] CreateDocumentDto 类定义完成');
