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
import { SVGParserService } from './svg-parser.service';
import { MindMapParserService } from './services/mindmap-parser.service';
import { GraphRepositoryService } from './services/graph-repository.service';
import {
  SVGParseRequestDto,
  SVGParseFromUrlDto,
  SVGParseFromStringDto,
  SVGParseResponseDto,
  InputType,
} from './dto/svg-parse.dto';
import { v4 as uuidv4 } from 'uuid';

@ApiTags('SVG & MindMap Parser')
@Controller('parser')
export class SVGParserController {
  private readonly logger = new Logger(SVGParserController.name);

  constructor(
    private readonly svgParserService: SVGParserService,
    private readonly mindMapParserService: MindMapParserService,
    private readonly graphRepository: GraphRepositoryService,
  ) {}

  // Existing SVG parsing endpoints can remain here...
  // For brevity, I'm focusing on the MindMap and Graph endpoints.

  @Post('mindmap/upload-and-store')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: '上传思维导图,解析并存入DynamoDB',
    description: '一步完成解析和存储,返回唯一的Graph ID',
  })
  @ApiResponse({ status: 201, description: '图创建成功' })
  async uploadAndParseMindMap(
    @UploadedFile() file: any,
    @Body() body: { format?: string },
  ) {
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
  @ApiResponse({ status: 200, description: '返回匹配的节点引用' })
  async searchNodes(@Query('keyword') keyword: string) {
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
  @ApiResponse({ status: 200, description: '返回子图数据' })
  async getSubgraph(
    @Param('graphId') graphId: string,
    @Param('nodeId') nodeId: string,
  ) {
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
