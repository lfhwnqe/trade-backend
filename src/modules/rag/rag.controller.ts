import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiQuery,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RAGService } from './rag.service';
import { MetadataService } from './metadata.service';
import {
  CreateDocumentDto,
  UpdateDocumentDto,
  SearchQueryDto,
} from './dto';
import {
  RetrievalResultDto,
} from './dto/rag-response.dto';
import { DocumentEntity } from './entities/document.entity';
import {
  DocumentFilter,
  DocumentType,
  DocumentStatus,
} from './types/rag.types';
import { ApiResponse as BaseApiResponse } from '../../base/interfaces/response.interface';
import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// 简单测试查询DTO
class SimpleTestQueryDto {
  @ApiProperty({
    description: '查询文本',
    example: '这是一个简单的RAG测试查询',
  })
  @IsString()
  query: string;

  @ApiProperty({
    description: '要上传的文本内容（可选）',
    example: '这是要向量化并存储到Upstash的文本内容',
    required: false,
  })
  @IsString()
  content?: string;
}

// 简单测试响应DTO
class SimpleTestResponseDto {
  @ApiProperty({
    description: '原始查询文本',
    example: '这是一个简单的RAG测试查询',
  })
  query: string;

  @ApiProperty({
    description: '测试响应消息',
    example: 'RAG系统测试成功',
  })
  message: string;

  @ApiProperty({
    description: '当前时间戳',
    example: '2024-01-15T10:30:00Z',
  })
  timestamp: string;

  @ApiProperty({
    description: '模拟的搜索结果',
    example: [
      '模拟结果1：这是第一个测试结果',
      '模拟结果2：这是第二个测试结果',
      '模拟结果3：这是第三个测试结果'
    ],
  })
  mockResults: string[];

  @ApiProperty({
    description: '系统状态',
    example: 'healthy',
  })
  status: string;

  @ApiProperty({
    description: '向量化处理结果（如果提供了content）',
    required: false,
  })
  vectorization?: {
    // 向量化模型信息
    model: string;
    // 生成的向量ID
    vectorId: string;
    // 存储状态
    storageStatus: 'success' | 'failed';
    // token使用量
    tokenUsage: {
      inputTokens: number;
      embeddingDimensions: number;
    };
    // 处理时间（毫秒）
    processingTimeMs: number;
    // 文本块信息
    chunkInfo: {
      chunkCount: number;
      totalCharacters: number;
      averageChunkSize: number;
    };
  };
}

@ApiTags('RAG 模块')
@ApiBearerAuth()
@Controller('rag')
export class RAGController {
  private readonly logger = new Logger(RAGController.name);

  constructor(
    private readonly ragService: RAGService,
    private readonly metadataService: MetadataService,
  ) {}

  // ==================== 文档管理接口 ====================

  @ApiOperation({ summary: '添加文档' })
  @ApiBody({ type: CreateDocumentDto })
  @ApiResponse({ status: 201, description: '文档创建成功' })
  @Post('documents')
  async uploadDocument(
    @Req() req: Request,
    @Body() dto: CreateDocumentDto,
  ): Promise<BaseApiResponse<DocumentEntity>> {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');

    const document = await this.ragService.uploadDocument(userId, dto);
    return {
      success: true,
      data: document,
      message: '文档上传成功',
      timestamp: new Date().toISOString(),
    };
  }

  @ApiOperation({ summary: '获取文档列表' })
  @ApiQuery({ name: 'documentType', enum: DocumentType, required: false })
  @ApiQuery({ name: 'status', enum: DocumentStatus, required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'pageSize', type: Number, required: false })
  @ApiResponse({ status: 200, description: '获取成功' })
  @Get('documents')
  async getDocuments(
    @Req() req: Request,
    @Query() query: any,
  ): Promise<BaseApiResponse<DocumentEntity[]>> {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');

    const filters: DocumentFilter = {
      documentType: query.documentType,
      status: query.status,
      page: query.page ? parseInt(query.page) : undefined,
      pageSize: query.pageSize ? parseInt(query.pageSize) : undefined,
    };

    const documents = await this.ragService.getDocuments(userId, filters);
    return {
      success: true,
      data: documents,
      timestamp: new Date().toISOString(),
    };
  }

  @ApiOperation({ summary: '获取单个文档' })
  @ApiParam({ name: 'id', description: '文档ID' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @Get('documents/:id')
  async getDocument(
    @Req() req: Request,
    @Param('id') documentId: string,
  ): Promise<BaseApiResponse<DocumentEntity>> {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');

    const document = await this.ragService.getDocument(userId, documentId);
    return {
      success: true,
      data: document,
      timestamp: new Date().toISOString(),
    };
  }

  @ApiOperation({ summary: '更新文档' })
  @ApiParam({ name: 'id', description: '文档ID' })
  @ApiBody({ type: UpdateDocumentDto })
  @ApiResponse({ status: 200, description: '更新成功' })
  @Put('documents/:id')
  async updateDocument(
    @Req() req: Request,
    @Param('id') documentId: string,
    @Body() dto: UpdateDocumentDto,
  ): Promise<BaseApiResponse<DocumentEntity>> {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');

    const document = await this.ragService.updateDocument(
      userId,
      documentId,
      dto,
    );
    return {
      success: true,
      data: document,
      message: '文档更新成功',
      timestamp: new Date().toISOString(),
    };
  }

  @ApiOperation({ summary: '删除文档' })
  @ApiParam({ name: 'id', description: '文档ID' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @Delete('documents/:id')
  async deleteDocument(
    @Req() req: Request,
    @Param('id') documentId: string,
  ): Promise<BaseApiResponse<void>> {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');

    await this.ragService.deleteDocument(userId, documentId);
    return {
      success: true,
      message: '文档删除成功',
      timestamp: new Date().toISOString(),
    };
  }

  // ==================== 搜索和查询接口 ====================

  @ApiOperation({ summary: '搜索文档' })
  @ApiBody({ type: SearchQueryDto })
  @ApiResponse({ status: 200, description: '搜索成功' })
  @Post('search')
  async searchDocuments(
    @Req() req: Request,
    @Body() dto: SearchQueryDto,
  ): Promise<BaseApiResponse<RetrievalResultDto>> {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');

    const result = await this.ragService.searchDocuments(userId, dto);
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  // ==================== 测试接口 ====================

  @ApiOperation({
    summary: 'RAG 简单测试接口',
    description: '用于调试的简单RAG测试接口，返回固定的测试数据，不需要用户权限验证'
  })
  @ApiBody({ type: SimpleTestQueryDto })
  @ApiResponse({
    status: 200,
    description: '测试成功',
    type: SimpleTestResponseDto
  })
  @Post('simple-test')
  async simpleTest(
    @Body() dto: SimpleTestQueryDto,
  ): Promise<BaseApiResponse<SimpleTestResponseDto>> {
    const currentTime = new Date().toISOString();
    
    let vectorizationResult;
    let message = 'RAG系统测试成功！您的查询已被正确接收和处理。';

    // 如果提供了content，进行向量化处理
    if (dto.content && dto.content.trim().length > 0) {
      try {
        vectorizationResult = await this.ragService.vectorizeAndStoreText(dto.content);
        message += ' 文本已成功向量化并存储到Upstash向量数据库。';
      } catch (error) {
        this.logger.error('Vectorization failed in simple test', error);
        message += ' 文本向量化处理失败，请检查系统配置。';
      }
    }
    
    // 创建测试响应数据
    const testResponse: SimpleTestResponseDto = {
      query: dto.query,
      message,
      timestamp: currentTime,
      mockResults: [
        `模拟结果1：针对查询"${dto.query}"的第一个相关文档片段`,
        `模拟结果2：这是一个包含关键信息的测试文档内容`,
        `模拟结果3：RAG系统正在正常工作，向量搜索功能可用`,
        `模拟结果4：文档检索和相似度计算功能正常`,
        `模拟结果5：测试完成，系统状态良好`
      ],
      status: 'healthy',
      vectorization: vectorizationResult
    };

    return {
      success: true,
      data: testResponse,
      message: 'RAG 简单测试完成',
      timestamp: currentTime,
    };
  }

  // ==================== 统计和健康检查接口 ====================

  @ApiOperation({ summary: 'RAG 系统健康检查' })
  @ApiResponse({ status: 200, description: '系统正常' })
  @Get('health')
  async healthCheck(): Promise<
    BaseApiResponse<{ status: string; timestamp: string }>
  > {
    return {
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
      },
      message: 'RAG 系统运行正常',
      timestamp: new Date().toISOString(),
    };
  }

  @ApiOperation({ summary: '获取用户的 RAG 使用统计' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @Get('analytics')
  async getAnalytics(@Req() req: Request): Promise<
    BaseApiResponse<{
      totalDocuments: number;
      documentsCompleted: number;
      documentsProcessing: number;
      documentsFailed: number;
    }>
  > {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');

    // 获取文档统计
    const allDocuments = await this.ragService.getDocuments(userId);
    const totalDocuments = allDocuments.length;
    const documentsCompleted = allDocuments.filter(
      (d) => d.status === DocumentStatus.COMPLETED,
    ).length;
    const documentsProcessing = allDocuments.filter(
      (d) => d.status === DocumentStatus.PROCESSING,
    ).length;
    const documentsFailed = allDocuments.filter(
      (d) => d.status === DocumentStatus.FAILED,
    ).length;

    return {
      success: true,
      data: {
        totalDocuments,
        documentsCompleted,
        documentsProcessing,
        documentsFailed,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
