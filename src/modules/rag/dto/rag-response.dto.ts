import { ApiProperty } from '@nestjs/swagger';

export class SearchResultDto {
  @ApiProperty({
    description: '文档ID',
    example: 'doc-123',
  })
  id: string;

  @ApiProperty({
    description: '相似度评分',
    example: 0.95,
  })
  score: number;

  @ApiProperty({
    description: '文档内容片段',
    example: '以太坊是一个去中心化的区块链平台...',
  })
  content: string;

  @ApiProperty({
    description: '文档元数据',
  })
  metadata: {
    userId: string;
    documentId: string;
    chunkIndex: number;
    documentType: string;
    title: string;
    tags?: string[];
    timestamp: string;
    tokenCount: number;
  };
}

export class DocumentSummaryDto {
  @ApiProperty({
    description: '文档ID',
    example: 'doc-123',
  })
  documentId: string;

  @ApiProperty({
    description: '文档标题',
    example: '以太坊技术分析指南',
  })
  title: string;

  @ApiProperty({
    description: '文档摘要',
    example: '本文档详细介绍了以太坊的技术分析方法...',
  })
  summary: string;

  @ApiProperty({
    description: '关键要点',
    example: ['支撑位和阻力位识别', '成交量分析的重要性', '技术指标的使用方法'],
  })
  keyPoints: string[];

  @ApiProperty({
    description: '字数统计',
    example: 2500,
  })
  wordCount: number;

  @ApiProperty({
    description: '生成时间',
    example: '2024-01-15T10:30:00Z',
  })
  generatedAt: string;
}

export class RetrievalResultDto {
  @ApiProperty({
    description: '查询文本',
    example: '如何进行以太坊技术分析',
  })
  query: string;

  @ApiProperty({
    description: '搜索结果',
    type: [SearchResultDto],
  })
  results: SearchResultDto[];

  @ApiProperty({
    description: '总结果数',
    example: 15,
  })
  totalResults: number;

  @ApiProperty({
    description: '处理时间（毫秒）',
    example: 350,
  })
  processingTime: number;

  @ApiProperty({
    description: '上下文文本',
    example: '根据检索到的文档内容，以下是相关信息...',
  })
  context: string;
}
