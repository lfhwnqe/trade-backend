import { Controller, Post, Get, Patch, Delete, Body, Param, Req, NotFoundException } from '@nestjs/common';
import { TradeService } from './trade.service';
import { CreateTradeDto } from './dto/create-trade.dto';
import { UpdateTradeDto } from './dto/update-trade.dto';
import { Trade } from './entities/trade.entity';
import { Request } from 'express';

@Controller('trade')
export class TradeController {
  constructor(private readonly tradeService: TradeService) {}

  // 创建交易记录
  @Post()
  async create(@Req() req: Request, @Body() dto: CreateTradeDto) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    const result = await this.tradeService.createTrade(userId, dto);
    return result;
  }

  // 查询单条记录
  @Get(':transactionId')
  async findOne(@Req() req: Request, @Param('transactionId') transactionId: string) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    const result = await this.tradeService.getTrade(userId, transactionId);
    return result;
  }

  // 查询用户全部
  @Get('list')
  async findAll(@Req() req: Request) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    // 默认第一页20条，可用query传递
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const pageSize = req.query.pageSize ? parseInt(String(req.query.pageSize), 10) : 20;
    const result = await this.tradeService.findByUserId(userId, page, pageSize);
    return result;
  }
// 新增：POST 方式的 list
  @Post('list')
  async findAllPost(@Req() req: Request) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    const { page, pageSize } = req.body || {};
    const p = page ? parseInt(page, 10) : 1;
    const ps = pageSize ? parseInt(pageSize, 10) : 20;
    const result = await this.tradeService.findByUserId(userId, p, ps);
    return result;
  }

  // 更新指定交易记录
  @Patch(':transactionId')
  async update(
    @Req() req: Request,
    @Param('transactionId') transactionId: string,
    @Body() dto: UpdateTradeDto
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    const result = await this.tradeService.updateTrade(userId, transactionId, dto);
    return result;
  }

  // 删除指定交易记录
  @Delete(':transactionId')
  async remove(@Req() req: Request, @Param('transactionId') transactionId: string) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    const result = await this.tradeService.deleteTrade(userId, transactionId);
    return result;
  }
}