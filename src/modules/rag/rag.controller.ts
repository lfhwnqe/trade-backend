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
import { CreateDocumentDto, UpdateDocumentDto, SearchQueryDto } from './dto';
import { RetrievalResultDto } from './dto/rag-response.dto';
import { DocumentEntity } from './entities/document.entity';
import {
  DocumentFilter,
  DocumentType,
  DocumentStatus,
} from './types/rag.types';
import { ApiResponse as BaseApiResponse } from '../../base/interfaces/response.interface';

@ApiTags('RAG 模块')
@ApiBearerAuth()
@Controller('rag')
export class RAGController {
  constructor(
    private readonly ragService: RAGService,
    private readonly metadataService: MetadataService,
  ) {}

  // ==================== 文档管理接口 ====================

  @ApiOperation({
    summary: '添加文档到知识库',
    description: `
支持的文档类型：
• TEXT - 纯文本文档
• HTML - HTML格式文档
• MARKDOWN - Markdown格式文档
• JSON - JSON格式文档
• PDF - PDF文档（需前端转换为文本）

使用 Mastra RAG 进行智能分块处理，优化向量化效果。
分块策略：递归分块，大小512，重叠50。
    `
  })
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

  // ==================== 统计和健康检查接口 ====================

  @ApiOperation({
    summary: 'RAG 系统健康检查',
    description: '检查 RAG 系统状态，包括 Mastra RAG 配置信息'
  })
  @ApiResponse({ status: 200, description: '系统正常' })
  @Get('health')
  async healthCheck(): Promise<
    BaseApiResponse<{
      status: string;
      timestamp: string;
      ragConfig: {
        chunkingEngine: string;
        supportedTypes: string[];
        chunkSize: number;
        chunkOverlap: number;
        embeddingModel: string;
        vectorDatabase: string;
      }
    }>
  > {
    return {
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        ragConfig: {
          chunkingEngine: 'Mastra RAG with MDocument',
          supportedTypes: ['TEXT', 'HTML', 'MARKDOWN', 'JSON', 'PDF'],
          chunkSize: 512,
          chunkOverlap: 50,
          embeddingModel: 'Google Gemini text-embedding-004',
          vectorDatabase: 'Upstash Vector'
        }
      },
      message: 'RAG 系统运行正常 - 使用 Mastra RAG 优化分块策略',
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
