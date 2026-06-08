import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CreateTradingViewTrainingRecordDto } from './dto/create-tradingview-training-record.dto';
import { GetTradingViewTrainingRecordAnalyticsDto } from './dto/get-tradingview-training-record-analytics.dto';
import { GetTradingViewTrainingRecordUploadUrlDto } from './dto/get-tradingview-training-record-upload-url.dto';
import { ListTradingViewTrainingRecordsDto } from './dto/list-tradingview-training-records.dto';
import { UpdateTradingViewTrainingRecordDto } from './dto/update-tradingview-training-record.dto';
import { TradingViewTrainingRecordService } from './tradingview-training-record.service';
import { TRADINGVIEW_TRAINING_RECORD_RESULT_VALUES } from './tradingview-training-record.types';

@ApiTags('TradingViewTrainingRecord')
@ApiBearerAuth()
@Controller('tradingview-training-record')
export class TradingViewTrainingRecordController {
  constructor(private readonly tradingViewTrainingRecordService: TradingViewTrainingRecordService) {}

  @ApiOperation({ summary: '获取 TradingView 训练记录图片上传 URL' })
  @ApiBody({ type: GetTradingViewTrainingRecordUploadUrlDto })
  @ApiResponse({ status: 200, description: '返回上传 URL 与文件 URL' })
  @Post('image/upload-url')
  async getUploadUrl(@Req() req: Request, @Body() dto: GetTradingViewTrainingRecordUploadUrlDto) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.tradingViewTrainingRecordService.getUploadUrl(userId, dto);
  }

  @ApiOperation({ summary: '创建 TradingView 训练记录' })
  @ApiBody({ type: CreateTradingViewTrainingRecordDto })
  @Post('records')
  async createRecord(@Req() req: Request, @Body() dto: CreateTradingViewTrainingRecordDto) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.tradingViewTrainingRecordService.createRecord(userId, dto);
  }

  @ApiOperation({ summary: '分页查询 TradingView 训练记录' })
  @ApiQuery({ name: 'pageSize', required: false, example: 20 })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'playbookType', required: false })
  @ApiQuery({ name: 'symbolPair', required: false })
  @ApiQuery({ name: 'tradeResult', required: false, enum: TRADINGVIEW_TRAINING_RECORD_RESULT_VALUES })
  @ApiQuery({ name: 'entryConfidenceRating', required: false, enum: [1, 2, 3, 4, 5] })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'keyword', required: false })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['CREATED_AT', 'UPDATED_AT'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @Get('records')
  async listRecords(@Req() req: Request, @Query() query: ListTradingViewTrainingRecordsDto) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.tradingViewTrainingRecordService.listRecords(userId, query);
  }

  @ApiOperation({ summary: '查询 TradingView 训练记录详情' })
  @ApiParam({ name: 'recordId', description: '训练记录 ID' })
  @Get('records/:recordId')
  async getRecord(@Req() req: Request, @Param('recordId') recordId: string) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.tradingViewTrainingRecordService.getRecord(userId, recordId);
  }

  @ApiOperation({ summary: '更新 TradingView 训练记录' })
  @ApiParam({ name: 'recordId', description: '训练记录 ID' })
  @ApiBody({ type: UpdateTradingViewTrainingRecordDto })
  @Patch('records/:recordId')
  async updateRecord(
    @Req() req: Request,
    @Param('recordId') recordId: string,
    @Body() dto: UpdateTradingViewTrainingRecordDto,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.tradingViewTrainingRecordService.updateRecord(userId, recordId, dto);
  }

  @ApiOperation({ summary: '删除 TradingView 训练记录' })
  @ApiParam({ name: 'recordId', description: '训练记录 ID' })
  @Delete('records/:recordId')
  async deleteRecord(@Req() req: Request, @Param('recordId') recordId: string) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.tradingViewTrainingRecordService.deleteRecord(userId, recordId);
  }

  @ApiOperation({ summary: 'TradingView 训练记录统计' })
  @Get('analytics')
  async getAnalytics(@Req() req: Request, @Query() query: GetTradingViewTrainingRecordAnalyticsDto) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.tradingViewTrainingRecordService.getAnalytics(userId, query);
  }
}
