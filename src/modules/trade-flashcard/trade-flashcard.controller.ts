import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
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
import { CreateTradeFlashcardCardDto } from './dto/create-trade-flashcard-card.dto';
import { ConvertTradeFlashcardToFlashcardDto } from './dto/convert-trade-flashcard-to-flashcard.dto';
import { GetTradeFlashcardUploadUrlDto } from './dto/get-trade-flashcard-upload-url.dto';
import { ListTradeFlashcardCardsDto } from './dto/list-trade-flashcard-cards.dto';
import { UpdateTradeFlashcardCardDto } from './dto/update-trade-flashcard-card.dto';
import { TradeFlashcardService } from './trade-flashcard.service';

@ApiTags('TradeFlashcard')
@ApiBearerAuth()
@Controller('trade-flashcard')
export class TradeFlashcardController {
  constructor(private readonly tradeFlashcardService: TradeFlashcardService) {}

  @ApiOperation({ summary: '获取交易闪卡图片上传 URL' })
  @ApiBody({ type: GetTradeFlashcardUploadUrlDto })
  @ApiResponse({ status: 200, description: '返回上传 URL 与文件 URL' })
  @Post('image/upload-url')
  async getUploadUrl(@Req() req: Request, @Body() dto: GetTradeFlashcardUploadUrlDto) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.tradeFlashcardService.getUploadUrl(userId, dto);
  }

  @ApiOperation({ summary: '创建交易闪卡' })
  @ApiBody({ type: CreateTradeFlashcardCardDto })
  @ApiResponse({ status: 200, description: '创建成功并返回卡片对象' })
  @Post('cards')
  async createCard(@Req() req: Request, @Body() dto: CreateTradeFlashcardCardDto) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.tradeFlashcardService.createCard(userId, dto);
  }

  @ApiOperation({ summary: '分页查询交易闪卡（管理页）' })
  @ApiQuery({ name: 'pageSize', required: false, example: 20 })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'tradeFlashcardType', required: false, enum: ['REAL_TRADE', 'SIM_TRADE'] })
  @ApiQuery({ name: 'lifecycleStatus', required: false, enum: ['IN_PROGRESS', 'COMPLETED'] })
  @ApiQuery({ name: 'symbolPairInfo', required: false })
  @ApiQuery({ name: 'playbookType', required: false })
  @ApiQuery({ name: 'marketTimeInfo', required: false })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['CREATED_AT', 'UPDATED_AT'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: 200, description: '返回分页数据 items + nextCursor' })
  @Get('cards')
  async listCards(@Req() req: Request, @Query() query: ListTradeFlashcardCardsDto) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.tradeFlashcardService.listCards(userId, query);
  }

  @ApiOperation({ summary: '更新交易闪卡' })
  @ApiParam({ name: 'cardId', description: '卡片 ID' })
  @ApiBody({ type: UpdateTradeFlashcardCardDto })
  @Patch('cards/:cardId')
  async updateCard(@Req() req: Request, @Param('cardId') cardId: string, @Body() dto: UpdateTradeFlashcardCardDto) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.tradeFlashcardService.updateCard(userId, cardId, dto);
  }

  @ApiOperation({ summary: '删除交易闪卡' })
  @ApiParam({ name: 'cardId', description: '卡片 ID' })
  @Delete('cards/:cardId')
  async deleteCard(@Req() req: Request, @Param('cardId') cardId: string) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.tradeFlashcardService.deleteCard(userId, cardId);
  }

  @ApiOperation({ summary: '把已完成的交易闪卡转换为常规训练闪卡' })
  @ApiParam({ name: 'cardId', description: '交易闪卡 ID' })
  @ApiBody({ type: ConvertTradeFlashcardToFlashcardDto })
  @Post('cards/:cardId/convert-to-flashcard')
  async convertToFlashcard(
    @Req() req: Request,
    @Param('cardId') cardId: string,
    @Body() dto: ConvertTradeFlashcardToFlashcardDto,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.tradeFlashcardService.convertToFlashcard(userId, cardId, dto);
  }
}
