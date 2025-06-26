import {
  Controller,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Logger,
  Get,
  Query,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { MindMapParserService } from './services/mindmap-parser.service';
import { GraphRepositoryService } from './services/graph-repository.service';
import {
  MindMapUploadDto,
  MindMapParseRequestDto,
  MindMapParseResponseDto,
  GraphCreateResponseDto,
  NodeSearchResultDto,
  SubgraphNodeDto,
} from './dto/mindmap-parse.dto';
import { v4 as uuidv4 } from 'uuid';

@ApiTags('MindMap Parser')
@Controller('parser')
export class MindMapParserController {
  private readonly logger = new Logger(MindMapParserController.name);

  constructor(
    private readonly mindMapParserService: MindMapParserService,
    private readonly graphRepository: GraphRepositoryService,
  ) {}

  @Post('mindmap/parse')
  @ApiOperation({
    summary: '解析思维导图内容',
    description: '解析思维导图内容并返回结构化数据，不存储到数据库',
  })
  @ApiResponse({
    status: 200,
    description: '解析成功',
    type: MindMapParseResponseDto,
  })
  async parseMindMap(
    @Body() body: MindMapParseRequestDto,
  ): Promise<MindMapParseResponseDto> {
    this.logger.log(`开始解析思维导图内容，格式: ${body.format}`);

    try {
      const mindMapData = await this.mindMapParserService.parseMindMap(
        body.content,
        body.format,
      );

      this.logger.log(
        `思维导图解析成功，节点数: ${mindMapData.nodes.length}，连接数: ${mindMapData.links.length}`,
      );

      return {
        success: true,
        data: {
          nodes: mindMapData.nodes,
          links: mindMapData.links,
          metadata: {
            format: mindMapData.metadata?.format || body.format,
            title: mindMapData.metadata?.title || '思维导图',
            author: mindMapData.metadata?.author,
            created: mindMapData.metadata?.created,
            modified: mindMapData.metadata?.modified,
          },
        },
      };
    } catch (error) {
      this.logger.error(`思维导图解析失败: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('mindmap/upload-and-store')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: '上传思维导图,解析并存入DynamoDB',
    description: '一步完成解析和存储,返回唯一的Graph ID',
  })
  @ApiResponse({
    status: 201,
    description: '图创建成功',
    type: GraphCreateResponseDto,
  })
  async uploadAndParseMindMap(
    @UploadedFile() file: any,
    @Body() body: MindMapUploadDto,
  ): Promise<GraphCreateResponseDto> {
    if (!file) {
      throw new BadRequestException('请上传文件');
    }

    this.logger.log(`开始处理并存储上传的思维导图: ${file.originalname}`);

    try {
      const content = file.buffer.toString('utf-8');
      const format = body.format || this.detectFileFormat(file.originalname);

      // 1. Parse the mind map file
      const mindMapData = await this.mindMapParserService.parseMindMap(
        content,
        format,
      );

      // 2. Generate a unique ID for the graph
      const graphId = `${file.originalname.split('.')[0]}-${uuidv4()}`;

      // 3. Store in DynamoDB
      await this.graphRepository.createGraph(graphId, mindMapData);

      this.logger.log(
        `图已成功存储, GraphID: ${graphId}, 节点: ${mindMapData.nodes.length}`,
      );

      return {
        message: 'Graph created successfully',
        graphId: graphId,
        nodeCount: mindMapData.nodes.length,
        edgeCount: mindMapData.links.length,
      };
    } catch (error) {
      this.logger.error(`思维导图文件处理失败: ${error.message}`, error.stack);
      throw new BadRequestException(`文件处理失败: ${error.message}`);
    }
  }

  @Get('graphs/search')
  @ApiOperation({
    summary: '根据关键词搜索节点',
    description: '使用反向索引在DynamoDB中快速查找包含关键词的节点',
  })
  @ApiQuery({ name: 'keyword', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: '返回匹配的节点引用',
    type: [NodeSearchResultDto],
  })
  async searchNodes(
    @Query('keyword') keyword: string,
  ): Promise<NodeSearchResultDto[]> {
    if (!keyword) {
      throw new BadRequestException('Keyword must be provided');
    }
    this.logger.log(`按关键词搜索节点: "${keyword}"`);
    return this.graphRepository.searchNodesByKeyword(keyword);
  }

  @Get('graphs/:graphId/nodes/:nodeId/subgraph')
  @ApiOperation({
    summary: '获取节点的上下文子图',
    description: '获取指定节点及其父节点和直接子节点,用于为RAG提供上下文',
  })
  @ApiParam({ name: 'graphId', required: true, type: String })
  @ApiParam({ name: 'nodeId', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: '返回子图数据',
    type: [SubgraphNodeDto],
  })
  async getSubgraph(
    @Param('graphId') graphId: string,
    @Param('nodeId') nodeId: string,
  ): Promise<SubgraphNodeDto[]> {
    this.logger.log(`获取子图, GraphID: ${graphId}, NodeID: ${nodeId}`);
    const subgraph = await this.graphRepository.getSubgraphForNode(
      graphId,
      nodeId,
    );
    if (subgraph.length === 0) {
      throw new NotFoundException(
        `Node with ID ${nodeId} not found in graph ${graphId}`,
      );
    }
    return subgraph;
  }

  private detectFileFormat(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'mm':
        return 'freemind';
      case 'opml':
        return 'opml';
      case 'json':
        return 'json';
      case 'md':
      case 'markdown':
        return 'markdown';
      default:
        throw new BadRequestException(`不支持的文件格式: ${ext}`);
    }
  }
}
