import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  NotFoundException,
} from '@nestjs/common';
import { TradeService } from './trade.service';
import { CreateTradeDto } from './dto/create-trade.dto';
import { UpdateTradeDto } from './dto/update-trade.dto';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { TradeQueryDto } from './dto/trade-query.dto';

@ApiTags('交易管理')
@ApiBearerAuth()
@Controller('trade')
export class TradeController {
  constructor(private readonly tradeService: TradeService) {}
  // 首页统计 GET /trade/stats
  @ApiOperation({ summary: '获取本月已离场交易数和胜率' })
  @ApiResponse({ status: 200, description: '统计数据获取成功' })
  @Get('stats')
  async getStats(@Req() req: Request) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    const data = await this.tradeService.getThisMonthStats(userId);
    return { success: true, data };
  }

  // 创建交易记录
  @ApiOperation({ summary: '创建交易记录' })
  @ApiBody({ type: CreateTradeDto })
  @ApiResponse({ status: 201, description: '创建成功' })
  @Post()
  async create(@Req() req: Request, @Body() dto: CreateTradeDto) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    const result = await this.tradeService.createTrade(userId, dto);
    return result;
  }

  // 查询单条记录
  @ApiOperation({ summary: '查询单条交易记录' })
  @ApiParam({ name: 'transactionId', description: '交易ID' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @Get(':transactionId')
  async findOne(
    @Req() req: Request,
    @Param('transactionId') transactionId: string,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    const result = await this.tradeService.getTrade(userId, transactionId);
    return result;
  }

  // 查询用户全部
  @ApiOperation({ summary: '查询用户所有交易记录' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @Get('list')
  async findAll(@Req() req: Request) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    // 默认第一页20条，可用query传递
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const pageSize = req.query.pageSize
      ? parseInt(String(req.query.pageSize), 10)
      : 20;
    const result = await this.tradeService.findByUserId(userId, page, pageSize);
    return result;
  }

  @ApiOperation({ summary: '分页获取交易总结字段（lessonsLearned）' })
  @ApiQuery({ name: 'page', required: false, description: '页码，默认1' })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    description: '每页数量，默认20，最大100',
  })
  @ApiResponse({ status: 200, description: '获取成功' })
  @Post('summaries')
  async getSummaries(@Req() req: Request) {
    
    const userId = (req as any).user?.sub;
    console.log('🌹getSummaries userId：', userId);
    if (!userId) throw new NotFoundException('用户信息异常');

    let page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    if (Number.isNaN(page) || page < 1) page = 1;
    let pageSize = req.query.pageSize
      ? parseInt(String(req.query.pageSize), 10)
      : 20;
    if (Number.isNaN(pageSize) || pageSize < 1) pageSize = 20;
    const cappedPageSize = Math.min(pageSize, 100);

    const result = await this.tradeService.getTradeSummaries(
      userId,
      page,
      cappedPageSize,
    );
    return result;
  }
  // 新增：POST 方式的 list
  @ApiOperation({ summary: '查询用户所有交易记录(POST方式)' })
  @ApiBody({
    schema: {
      properties: {
        page: { type: 'number', example: 1 },
        pageSize: { type: 'number', example: 20 },
        marketStructure: {
          type: 'string',
          example: '震荡',
          description: '市场结构',
        },
        entryDirection: {
          type: 'string',
          example: '多',
          description: '交易方向',
        },
        tradeStatus: {
          type: 'string',
          example: '已离场',
          description: '交易状态',
        },
        grade: {
          type: 'string',
          enum: ['高', '中', '低'],
          example: '高',
          description: '交易分级',
        },
        analysisExpired: {
          type: 'boolean',
          example: false,
          description: '分析是否过期',
        },
        dateFrom: {
          type: 'string',
          example: '2025-01-01',
          description: '开始日期',
        },
        dateTo: {
          type: 'string',
          example: '2025-05-29',
          description: '结束日期',
        },
        tradeResult: {
          type: 'string',
          example: 'PROFIT',
          description: '交易结果',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: '查询成功' })
  @Post('list')
  async findAllPost(@Body() dto: TradeQueryDto, @Req() req: Request) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    const result = await this.tradeService.findByUserQuery(userId, dto);
    return result;
  }

  // 更新指定交易记录
  @ApiOperation({ summary: '更新交易记录' })
  @ApiParam({ name: 'transactionId', description: '交易ID' })
  @ApiBody({ type: UpdateTradeDto })
  @ApiResponse({ status: 200, description: '更新成功' })
  @Patch(':transactionId')
  async update(
    @Req() req: Request,
    @Param('transactionId') transactionId: string,
    @Body() dto: UpdateTradeDto,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    const result = await this.tradeService.updateTrade(
      userId,
      transactionId,
      dto,
    );
    return result;
  }

  // 删除指定交易记录
  @ApiOperation({ summary: '删除交易记录' })
  @ApiParam({ name: 'transactionId', description: '交易ID' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @Delete(':transactionId')
  async remove(
    @Req() req: Request,
    @Param('transactionId') transactionId: string,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    const result = await this.tradeService.deleteTrade(userId, transactionId);
    return result;
  }

  // 复制交易记录
  @ApiOperation({ summary: '复制交易记录' })
  @ApiParam({ name: 'transactionId', description: '要复制的交易ID' })
  @ApiResponse({ status: 201, description: '复制成功' })
  @Post(':transactionId/copy')
  async copyTrade(
    @Req() req: Request,
    @Param('transactionId') transactionId: string,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    const result = await this.tradeService.copyTrade(userId, transactionId);
    return result;
  }
}
