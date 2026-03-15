import {
  Body,
  Controller,
  Delete,
  Patch,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { FlashcardService } from './flashcard.service';
import { GetFlashcardUploadUrlDto } from './dto/get-upload-url.dto';
import { CreateFlashcardCardDto } from './dto/create-flashcard-card.dto';
import { RandomFlashcardCardsDto } from './dto/random-flashcard-cards.dto';
import { ListFlashcardCardsDto } from './dto/list-flashcard-cards.dto';
import { StartFlashcardDrillSessionDto } from './dto/start-flashcard-drill-session.dto';
import { CreateFlashcardDrillAttemptDto } from './dto/create-flashcard-drill-attempt.dto';
import { UpdateFlashcardNoteDto } from './dto/update-flashcard-note.dto';
import { ListFlashcardDrillSessionsDto } from './dto/list-flashcard-drill-sessions.dto';
import { UpdateFlashcardCardDto } from './dto/update-flashcard-card.dto';
import { GetFlashcardDrillAnalyticsDto } from './dto/get-flashcard-drill-analytics.dto';
import { StartFlashcardSimulationSessionDto } from './dto/start-flashcard-simulation-session.dto';
import { CreateFlashcardSimulationAttemptDto } from './dto/create-flashcard-simulation-attempt.dto';
import { ResolveFlashcardSimulationAttemptDto } from './dto/resolve-flashcard-simulation-attempt.dto';
import { ListFlashcardSimulationSessionsDto } from './dto/list-flashcard-simulation-sessions.dto';
import { ListFlashcardSimulationCardHistoryDto } from './dto/list-flashcard-simulation-card-history.dto';
import { ListFlashcardSimulationAttemptsDto } from './dto/list-flashcard-simulation-attempts.dto';

@ApiTags('Flashcard')
@ApiBearerAuth()
@Controller('flashcard')
export class FlashcardController {
  constructor(private readonly flashcardService: FlashcardService) {}

  @ApiOperation({ summary: '获取闪卡图片上传 URL' })
  @ApiBody({ type: GetFlashcardUploadUrlDto })
  @ApiResponse({ status: 200, description: '返回上传 URL 与文件 URL' })
  @Post('image/upload-url')
  async getUploadUrl(
    @Req() req: Request,
    @Body() dto: GetFlashcardUploadUrlDto,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) {
      throw new NotFoundException('用户信息异常');
    }

    return this.flashcardService.getUploadUrl(userId, dto);
  }

  @ApiOperation({ summary: '创建闪卡' })
  @ApiBody({ type: CreateFlashcardCardDto })
  @ApiResponse({ status: 200, description: '创建成功并返回卡片对象' })
  @Post('cards')
  async createCard(@Req() req: Request, @Body() dto: CreateFlashcardCardDto) {
    const userId = (req as any).user?.sub;
    if (!userId) {
      throw new NotFoundException('用户信息异常');
    }

    return this.flashcardService.createCard(userId, dto);
  }

  @ApiOperation({ summary: '随机抽取闪卡' })
  @ApiBody({ type: RandomFlashcardCardsDto })
  @ApiResponse({ status: 200, description: '返回乱序卡片数组' })
  @Post('cards/random')
  async randomCards(@Req() req: Request, @Body() dto: RandomFlashcardCardsDto) {
    const userId = (req as any).user?.sub;
    if (!userId) {
      throw new NotFoundException('用户信息异常');
    }

    return this.flashcardService.randomCards(userId, dto);
  }

  @ApiOperation({ summary: '获取闪卡当日新增统计' })
  @ApiQuery({
    name: 'timezone',
    required: false,
    example: 'Asia/Shanghai',
    description: '按指定 IANA 时区统计当日新增，默认 Asia/Shanghai',
  })
  @ApiResponse({
    status: 200,
    description: '返回当日是否有新增、数量与当日日期',
  })
  @Get('cards/today-summary')
  async getTodaySummary(
    @Req() req: Request,
    @Query('timezone') timezone?: string,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) {
      throw new NotFoundException('用户信息异常');
    }

    return this.flashcardService.getTodaySummary(userId, timezone);
  }

  @ApiOperation({ summary: '获取闪卡当日收集摘要' })
  @ApiQuery({
    name: 'timezone',
    required: false,
    example: 'Asia/Shanghai',
    description: '按指定 IANA 时区统计当日新增收集摘要，默认 Asia/Shanghai',
  })
  @ApiResponse({
    status: 200,
    description:
      '返回当日新增数量、收集分布、最近收集时间与 collectionState',
  })
  @Get('cards/today-collection-summary')
  async getTodayCollectionSummary(
    @Req() req: Request,
    @Query('timezone') timezone?: string,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) {
      throw new NotFoundException('用户信息异常');
    }

    return this.flashcardService.getTodayCollectionSummary(userId, timezone);
  }

  @ApiOperation({ summary: '分页查询闪卡（管理页）' })
  @ApiQuery({ name: 'pageSize', required: false, example: 20 })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'behaviorType', required: false })
  @ApiQuery({ name: 'invalidationType', required: false })
  @ApiQuery({ name: 'symbolPairInfo', required: false })
  @ApiQuery({ name: 'marketTimeInfo', required: false })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['CREATED_AT', 'QUALITY_SCORE_AVG', 'SIMULATION_RESOLVED_COUNT', 'SIMULATION_AVG_RR'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: 200, description: '返回分页数据 items + nextCursor' })
  @Get('cards')
  async listCards(@Req() req: Request, @Query() query: ListFlashcardCardsDto) {
    const userId = (req as any).user?.sub;
    if (!userId) {
      throw new NotFoundException('用户信息异常');
    }

    return this.flashcardService.listCards(userId, query);
  }

  @ApiOperation({ summary: '删除闪卡' })
  @ApiParam({ name: 'cardId', description: '卡片 ID' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @Delete('cards/:cardId')
  async deleteCard(@Req() req: Request, @Param('cardId') cardId: string) {
    const userId = (req as any).user?.sub;
    if (!userId) {
      throw new NotFoundException('用户信息异常');
    }

    return this.flashcardService.deleteCard(userId, cardId);
  }

  @ApiOperation({ summary: '开始一次闪卡练习并创建会话' })
  @ApiBody({ type: StartFlashcardDrillSessionDto })
  @ApiResponse({ status: 200, description: '返回 sessionId 与抽题结果' })
  @Post('drill/session/start')
  async startSession(
    @Req() req: Request,
    @Body() dto: StartFlashcardDrillSessionDto,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) {
      throw new NotFoundException('用户信息异常');
    }

    return this.flashcardService.startSession(userId, dto);
  }

  @ApiOperation({ summary: '提交单题作答结果（写入会话记录）' })
  @ApiBody({ type: CreateFlashcardDrillAttemptDto })
  @ApiResponse({ status: 200, description: '返回本题判定与会话实时统计' })
  @Post('drill/session/:sessionId/attempt')
  async submitAttempt(
    @Req() req: Request,
    @Param('sessionId') sessionId: string,
    @Body() dto: CreateFlashcardDrillAttemptDto,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) {
      throw new NotFoundException('用户信息异常');
    }

    return this.flashcardService.submitAttempt(userId, sessionId, dto);
  }

  @ApiOperation({ summary: '结束一次闪卡练习并返回分数' })
  @ApiResponse({ status: 200, description: '返回 score 与会话统计' })
  @Post('drill/session/:sessionId/finish')
  async finishSession(
    @Req() req: Request,
    @Param('sessionId') sessionId: string,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) {
      throw new NotFoundException('用户信息异常');
    }

    return this.flashcardService.finishSession(userId, sessionId);
  }

  @ApiOperation({ summary: '分页查询闪卡练习历史（按时间倒序）' })
  @ApiQuery({ name: 'pageSize', required: false, example: 20 })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['IN_PROGRESS', 'COMPLETED', 'ABANDONED'],
  })
  @ApiResponse({ status: 200, description: '返回历史会话 items + nextCursor' })
  @Get('drill/sessions')
  async listDrillSessions(
    @Req() req: Request,
    @Query() query: ListFlashcardDrillSessionsDto,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) {
      throw new NotFoundException('用户信息异常');
    }

    return this.flashcardService.listDrillSessions(userId, query);
  }

  @ApiOperation({ summary: '获取训练成绩聚合分析' })
  @ApiQuery({ name: 'recentWindow', required: false, example: 30 })
  @ApiResponse({
    status: 200,
    description: '返回全量成绩概览、近 N 轮趋势与 behavior/invalidation 统计',
  })
  @Get('drill/analytics')
  async getDrillAnalytics(
    @Req() req: Request,
    @Query() query: GetFlashcardDrillAnalyticsDto,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) {
      throw new NotFoundException('用户信息异常');
    }

    return this.flashcardService.getDrillAnalytics(userId, query);
  }

  @ApiOperation({ summary: '开始一次闪卡模拟盘训练并创建会话' })
  @ApiBody({ type: StartFlashcardSimulationSessionDto })
  @ApiResponse({ status: 200, description: '返回 simulationSessionId 与抽题结果' })
  @Post('simulation/session/start')
  async startSimulationSession(
    @Req() req: Request,
    @Body() dto: StartFlashcardSimulationSessionDto,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) {
      throw new NotFoundException('用户信息异常');
    }

    return this.flashcardService.startSimulationSession(userId, dto);
  }

  @ApiOperation({ summary: '保存一次模拟盘入场尝试' })
  @ApiBody({ type: CreateFlashcardSimulationAttemptDto })
  @ApiResponse({ status: 200, description: '返回 attemptId、尝试快照与卡片聚合指标' })
  @Post('simulation/session/:sessionId/attempts')
  async createSimulationAttempt(
    @Req() req: Request,
    @Param('sessionId') sessionId: string,
    @Body() dto: CreateFlashcardSimulationAttemptDto,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) {
      throw new NotFoundException('用户信息异常');
    }

    return this.flashcardService.createSimulationAttempt(userId, sessionId, dto);
  }

  @ApiOperation({ summary: '保存一次模拟盘尝试的最终结果' })
  @ApiBody({ type: ResolveFlashcardSimulationAttemptDto })
  @ApiResponse({ status: 200, description: '返回实时统计与卡片聚合指标' })
  @Post('simulation/attempts/:attemptId/resolve')
  async resolveSimulationAttempt(
    @Req() req: Request,
    @Param('attemptId') attemptId: string,
    @Body() dto: ResolveFlashcardSimulationAttemptDto,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) {
      throw new NotFoundException('用户信息异常');
    }

    return this.flashcardService.resolveSimulationAttempt(userId, attemptId, dto);
  }

  @ApiOperation({ summary: '结束一次闪卡模拟盘训练并返回统计' })
  @ApiResponse({ status: 200, description: '返回 success/failure 统计' })
  @Post('simulation/session/:sessionId/finish')
  async finishSimulationSession(
    @Req() req: Request,
    @Param('sessionId') sessionId: string,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) {
      throw new NotFoundException('用户信息异常');
    }

    return this.flashcardService.finishSimulationSession(userId, sessionId);
  }

  @ApiOperation({ summary: '分页查询闪卡模拟盘训练历史（按时间倒序）' })
  @ApiQuery({ name: 'pageSize', required: false, example: 20 })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['IN_PROGRESS', 'COMPLETED', 'ABANDONED'],
  })
  @ApiResponse({ status: 200, description: '返回 simulation 历史 items + nextCursor' })
  @Get('simulation/sessions')
  async listSimulationSessions(
    @Req() req: Request,
    @Query() query: ListFlashcardSimulationSessionsDto,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) {
      throw new NotFoundException('用户信息异常');
    }

    return this.flashcardService.listSimulationSessions(userId, query);
  }

  @ApiOperation({ summary: '分页查询当前用户的模拟盘训练记录（按时间倒序）' })
  @ApiQuery({ name: 'pageSize', required: false, example: 20 })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'result', required: false, enum: ['ALL', 'SUCCESS', 'FAILURE'] })
  @ApiResponse({ status: 200, description: '返回 simulation attempts 列表 + nextCursor' })
  @Get('simulation/attempts')
  async listSimulationAttempts(
    @Req() req: Request,
    @Query() query: ListFlashcardSimulationAttemptsDto,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) {
      throw new NotFoundException('用户信息异常');
    }

    return this.flashcardService.listSimulationAttempts(userId, query);
  }

  @ApiOperation({ summary: '查询某张闪卡的模拟盘训练历史与失败备注' })
  @ApiQuery({ name: 'pageSize', required: false, example: 20 })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiResponse({ status: 200, description: '返回该卡片的 simulation 历史与摘要' })
  @Get('simulation/cards/:cardId/history')
  async getSimulationCardHistory(
    @Req() req: Request,
    @Param('cardId') cardId: string,
    @Query() query: ListFlashcardSimulationCardHistoryDto,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) {
      throw new NotFoundException('用户信息异常');
    }

    return this.flashcardService.getSimulationCardHistory(userId, cardId, query);
  }

  @ApiOperation({ summary: '获取错题集' })
  @ApiResponse({ status: 200, description: '返回错题集卡片列表' })
  @Get('review/wrong-book')
  async listWrongBook(@Req() req: Request) {
    const userId = (req as any).user?.sub;
    if (!userId) {
      throw new NotFoundException('用户信息异常');
    }

    return this.flashcardService.listWrongBook(userId);
  }

  @ApiOperation({ summary: '获取收藏库' })
  @ApiResponse({ status: 200, description: '返回收藏卡片列表' })
  @Get('review/favorites')
  async listFavorites(@Req() req: Request) {
    const userId = (req as any).user?.sub;
    if (!userId) {
      throw new NotFoundException('用户信息异常');
    }

    return this.flashcardService.listFavorites(userId);
  }

  @ApiOperation({ summary: '更新题目备注' })
  @ApiParam({ name: 'cardId', description: '卡片 ID' })
  @ApiBody({ type: UpdateFlashcardNoteDto })
  @ApiResponse({ status: 200, description: '更新成功并返回卡片对象' })
  @Patch('cards/:cardId/note')
  async updateCardNote(
    @Req() req: Request,
    @Param('cardId') cardId: string,
    @Body() dto: UpdateFlashcardNoteDto,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) {
      throw new NotFoundException('用户信息异常');
    }

    return this.flashcardService.updateCardNote(userId, cardId, dto.note);
  }

  @ApiOperation({ summary: '更新闪卡信息' })
  @ApiParam({ name: 'cardId', description: '卡片 ID' })
  @ApiBody({ type: UpdateFlashcardCardDto })
  @ApiResponse({ status: 200, description: '更新成功并返回卡片对象' })
  @Patch('cards/:cardId')
  async updateCard(
    @Req() req: Request,
    @Param('cardId') cardId: string,
    @Body() dto: UpdateFlashcardCardDto,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) {
      throw new NotFoundException('用户信息异常');
    }

    return this.flashcardService.updateCard(userId, cardId, dto);
  }
}
