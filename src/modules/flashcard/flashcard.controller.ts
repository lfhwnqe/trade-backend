import {
  Body,
  Controller,
  Delete,
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
  @ApiResponse({ status: 200, description: '返回分页数据 items + nextCursor' })
  @Get('cards')
  async listCards(
    @Req() req: Request,
    @Query() query: ListFlashcardCardsDto,
  ) {
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
}
