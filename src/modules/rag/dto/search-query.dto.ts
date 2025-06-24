import {
  IsString,
  IsNumber,
  IsArray,
  IsEnum,
  IsOptional,
  IsBoolean,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { DocumentType } from '../types/rag.types';
import { DateRangeDto } from './create-document.dto';

export class SearchQueryDto {
  @ApiProperty({
    description: '搜索查询文本',
    example: '如何进行以太坊技术分析？',
  })
  @IsString()
  query: string;

  @ApiProperty({
    description: '最大返回结果数',
    example: 10,
    minimum: 1,
    maximum: 50,
    required: false,
  })
  @IsNumber()
  @Min(1)
  @Max(50)
  @IsOptional()
  maxResults?: number;

  @ApiProperty({
    description: '相似度阈值 (0-1)',
    example: 0.7,
    minimum: 0,
    maximum: 1,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  similarityThreshold?: number;

  @ApiProperty({
    description: '文档类型过滤',
    enum: DocumentType,
    isArray: true,
    example: [DocumentType.KNOWLEDGE, DocumentType.TRADE],
    required: false,
  })
  @IsArray()
  @IsEnum(DocumentType, { each: true })
  @IsOptional()
  documentTypes?: DocumentType[];

  @ApiProperty({
    description: '标签过滤',
    example: ['以太坊', '技术分析'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiProperty({
    description: '时间范围过滤',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => DateRangeDto)
  dateRange?: DateRangeDto;

  @ApiProperty({
    description: '是否重新排序结果',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  rerankResults?: boolean;

  @ApiProperty({
    description: '是否包含元数据',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  includeMetadata?: boolean;

  @ApiProperty({
    description: '指定搜索的文档ID列表',
    example: ['doc-123', 'doc-456'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  documentIds?: string[];
}
