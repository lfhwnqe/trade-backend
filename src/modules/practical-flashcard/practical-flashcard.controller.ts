import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CreatePracticalFlashcardCardDto } from './dto/create-practical-flashcard-card.dto';
import { CreatePracticalFlashcardFromTradeFlashcardDto } from './dto/create-practical-flashcard-from-trade-flashcard.dto';
import { ListPracticalFlashcardCardsDto } from './dto/list-practical-flashcard-cards.dto';
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
}
