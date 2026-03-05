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

  @ApiOperation({ summary: '分页查询闪卡（管理页）' })
  @ApiQuery({ name: 'pageSize', required: false, example: 20 })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'direction', required: false })
  @ApiQuery({ name: 'context', required: false })
  @ApiQuery({ name: 'orderFlowFeature', required: false })
  @ApiQuery({ name: 'result', required: false })
  @ApiQuery({ name: 'symbolPairInfo', required: false })
  @ApiQuery({ name: 'marketTimeInfo', required: false })
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
