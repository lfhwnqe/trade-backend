import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CreatePracticalFlashcardCardDto } from './dto/create-practical-flashcard-card.dto';
import { CreatePracticalFlashcardAttemptTradeDto } from './dto/create-practical-flashcard-attempt-trade.dto';
import { CreatePracticalFlashcardFromTradeFlashcardDto } from './dto/create-practical-flashcard-from-trade-flashcard.dto';
import { GetPracticalFlashcardDashboardAnalyticsDto } from './dto/get-practical-flashcard-dashboard-analytics.dto';
import { ListPracticalFlashcardAttemptsDto } from './dto/list-practical-flashcard-attempts.dto';
import { ListPracticalFlashcardCardsDto } from './dto/list-practical-flashcard-cards.dto';
import { ResolvePracticalFlashcardAttemptDto } from './dto/resolve-practical-flashcard-attempt.dto';
import { StartRandomPracticalFlashcardTrainingDto } from './dto/start-random-practical-flashcard-training.dto';
import { StartPracticalFlashcardAttemptDto } from './dto/start-practical-flashcard-attempt.dto';
import { UpdatePracticalFlashcardCardDto } from './dto/update-practical-flashcard-card.dto';
import { PracticalFlashcardService } from './practical-flashcard.service';

@ApiTags('PracticalFlashcard')
@ApiBearerAuth()
@Controller('practical-flashcard')
export class PracticalFlashcardController {
  constructor(private readonly practicalFlashcardService: PracticalFlashcardService) {}

  @ApiOperation({ summary: '创建实操闪卡并冻结 Binance 历史行情快照' })
  @ApiBody({ type: CreatePracticalFlashcardCardDto })
  @ApiResponse({ status: 200, description: '创建成功并返回实操闪卡' })
  @Post('cards')
  async createCard(@Req() req: Request, @Body() dto: CreatePracticalFlashcardCardDto) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.practicalFlashcardService.createCard(userId, dto);
  }

  @ApiOperation({ summary: '从已完成交易闪卡派生实操闪卡' })
  @ApiParam({ name: 'tradeFlashcardId', description: '交易闪卡 ID' })
  @ApiBody({ type: CreatePracticalFlashcardFromTradeFlashcardDto })
  @Post('cards/from-trade-flashcard/:tradeFlashcardId')
  async createFromTradeFlashcard(
    @Req() req: Request,
    @Param('tradeFlashcardId') tradeFlashcardId: string,
    @Body() dto: CreatePracticalFlashcardFromTradeFlashcardDto,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.practicalFlashcardService.createFromTradeFlashcard(userId, tradeFlashcardId, dto);
  }

  @ApiOperation({ summary: '分页查询实操闪卡' })
  @ApiQuery({ name: 'pageSize', required: false, example: 20 })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['ACTIVE', 'DISABLED'] })
  @ApiQuery({ name: 'symbolPairInfo', required: false })
  @ApiQuery({ name: 'playbookType', required: false })
  @Get('cards')
  async listCards(@Req() req: Request, @Query() query: ListPracticalFlashcardCardsDto) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.practicalFlashcardService.listCards(userId, query);
  }

  @ApiOperation({ summary: '获取实操闪卡详情与冻结行情快照' })
  @ApiParam({ name: 'cardId', description: '实操闪卡 ID' })
  @Get('cards/:cardId')
  async getCard(@Req() req: Request, @Param('cardId') cardId: string) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.practicalFlashcardService.getCard(userId, cardId);
  }

  @ApiOperation({ summary: '更新实操闪卡非行情字段' })
  @ApiParam({ name: 'cardId', description: '实操闪卡 ID' })
  @ApiBody({ type: UpdatePracticalFlashcardCardDto })
  @Patch('cards/:cardId')
  async updateCard(@Req() req: Request, @Param('cardId') cardId: string, @Body() dto: UpdatePracticalFlashcardCardDto) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.practicalFlashcardService.updateCard(userId, cardId, dto);
  }

  @ApiOperation({ summary: '删除实操闪卡' })
  @ApiParam({ name: 'cardId', description: '实操闪卡 ID' })
  @Delete('cards/:cardId')
  async deleteCard(@Req() req: Request, @Param('cardId') cardId: string) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.practicalFlashcardService.deleteCard(userId, cardId);
  }

  @ApiOperation({ summary: '开始一次实操闪卡训练 attempt' })
  @ApiBody({ type: StartPracticalFlashcardAttemptDto })
  @Post('attempts/start')
  async startAttempt(@Req() req: Request, @Body() dto: StartPracticalFlashcardAttemptDto) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.practicalFlashcardService.startAttempt(userId, dto);
  }

  @ApiOperation({ summary: '随机抽取一张实操闪卡并开始训练' })
  @ApiBody({ type: StartRandomPracticalFlashcardTrainingDto })
  @Post('training/random/start')
  async startRandomTraining(@Req() req: Request, @Body() dto: StartRandomPracticalFlashcardTrainingDto) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.practicalFlashcardService.startRandomTraining(userId, dto);
  }

  @ApiOperation({ summary: '确认实操闪卡训练交易' })
  @ApiParam({ name: 'attemptId', description: '实操训练 attempt ID' })
  @ApiBody({ type: CreatePracticalFlashcardAttemptTradeDto })
  @Post('attempts/:attemptId/trade')
  async createAttemptTrade(
    @Req() req: Request,
    @Param('attemptId') attemptId: string,
    @Body() dto: CreatePracticalFlashcardAttemptTradeDto,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.practicalFlashcardService.createAttemptTrade(userId, attemptId, dto);
  }

  @ApiOperation({ summary: '完成实操闪卡训练 attempt 并保存复盘字段' })
  @ApiParam({ name: 'attemptId', description: '实操训练 attempt ID' })
  @ApiBody({ type: ResolvePracticalFlashcardAttemptDto })
  @Post('attempts/:attemptId/resolve')
  async resolveAttempt(
    @Req() req: Request,
    @Param('attemptId') attemptId: string,
    @Body() dto: ResolvePracticalFlashcardAttemptDto,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.practicalFlashcardService.resolveAttempt(userId, attemptId, dto);
  }

  @ApiOperation({ summary: '分页查询实操闪卡训练记录' })
  @ApiQuery({ name: 'pageSize', required: false, example: 20 })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'cardId', required: false })
  @ApiQuery({ name: 'decision', required: false, enum: ['LONG', 'SHORT', 'NO_ENTRY'] })
  @ApiQuery({ name: 'isWin', required: false })
  @Get('attempts')
  async listAttempts(@Req() req: Request, @Query() query: ListPracticalFlashcardAttemptsDto) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.practicalFlashcardService.listAttempts(userId, query);
  }

  @ApiOperation({ summary: '查询实操闪卡训练统计 Dashboard' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'playbookType', required: false })
  @ApiQuery({ name: 'symbolPairInfo', required: false })
  @Get('analytics/dashboard')
  async getDashboardAnalytics(
    @Req() req: Request,
    @Query() query: GetPracticalFlashcardDashboardAnalyticsDto,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.practicalFlashcardService.getDashboardAnalytics(userId, query);
  }

  @ApiOperation({ summary: '获取单次实操闪卡训练详情' })
  @ApiParam({ name: 'attemptId', description: '实操训练 attempt ID' })
  @Get('attempts/:attemptId')
  async getAttempt(@Req() req: Request, @Param('attemptId') attemptId: string) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.practicalFlashcardService.getAttempt(userId, attemptId);
  }
}
