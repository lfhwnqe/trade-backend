import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Role, Roles } from '../../base/decorators/roles.decorator';
import { RolesGuard } from '../../base/guards/roles.guard';
import { CreateImageRecognitionFlashcardCardDto } from './dto/create-image-recognition-flashcard-card.dto';
import { GetImageRecognitionFlashcardUploadUrlDto } from './dto/get-image-recognition-flashcard-upload-url.dto';
import { ListImageRecognitionFlashcardCardsDto } from './dto/list-image-recognition-flashcard-cards.dto';
import { RandomImageRecognitionFlashcardTrainingDto } from './dto/random-image-recognition-flashcard-training.dto';
import { UpdateImageRecognitionFlashcardCardDto } from './dto/update-image-recognition-flashcard-card.dto';
import { ImageRecognitionFlashcardService } from './image-recognition-flashcard.service';

@ApiTags('ImageRecognitionFlashcard')
@ApiBearerAuth()
@Controller('image-recognition-flashcard')
export class ImageRecognitionFlashcardController {
  constructor(private readonly imageRecognitionFlashcardService: ImageRecognitionFlashcardService) {}

  @ApiOperation({ summary: '获取图片识别闪卡上传 URL' })
  @ApiBody({ type: GetImageRecognitionFlashcardUploadUrlDto })
  @ApiResponse({ status: 200, description: '返回上传 URL 与文件 URL' })
  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.SuperAdmin)
  @Post('image/upload-url')
  async getUploadUrl(@Req() req: Request, @Body() dto: GetImageRecognitionFlashcardUploadUrlDto) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.imageRecognitionFlashcardService.getUploadUrl(userId, dto);
  }

  @ApiOperation({ summary: '创建图片识别闪卡' })
  @ApiBody({ type: CreateImageRecognitionFlashcardCardDto })
  @ApiResponse({ status: 200, description: '创建成功并返回图片识别闪卡' })
  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.SuperAdmin)
  @Post('cards')
  async createCard(@Req() req: Request, @Body() dto: CreateImageRecognitionFlashcardCardDto) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.imageRecognitionFlashcardService.createCard(userId, dto, this.getPrimaryRole(req));
  }

  @ApiOperation({ summary: '分页查询图片识别闪卡（管理页）' })
  @ApiQuery({ name: 'pageSize', required: false, example: 20 })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'playbookType', required: false })
  @ApiQuery({ name: 'sampleResult', required: false, enum: ['SUCCESS', 'FAIL'] })
  @ApiQuery({ name: 'status', required: false, enum: ['ACTIVE', 'DISABLED', 'ALL'] })
  @ApiQuery({ name: 'keyword', required: false })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['CREATED_AT', 'UPDATED_AT'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.SuperAdmin)
  @Get('cards')
  async listCards(@Req() req: Request, @Query() query: ListImageRecognitionFlashcardCardsDto) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.imageRecognitionFlashcardService.listCards(userId, query);
  }

  @ApiOperation({ summary: '更新图片识别闪卡' })
  @ApiParam({ name: 'cardId', description: '图片识别闪卡 ID' })
  @ApiBody({ type: UpdateImageRecognitionFlashcardCardDto })
  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.SuperAdmin)
  @Patch('cards/:cardId')
  async updateCard(
    @Req() req: Request,
    @Param('cardId') cardId: string,
    @Body() dto: UpdateImageRecognitionFlashcardCardDto,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.imageRecognitionFlashcardService.updateCard(userId, cardId, dto);
  }

  @ApiOperation({ summary: '删除图片识别闪卡' })
  @ApiParam({ name: 'cardId', description: '图片识别闪卡 ID' })
  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.SuperAdmin)
  @Delete('cards/:cardId')
  async deleteCard(@Req() req: Request, @Param('cardId') cardId: string) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.imageRecognitionFlashcardService.deleteCard(userId, cardId);
  }

  @ApiOperation({ summary: '随机抽取图片识别闪卡用于浏览训练' })
  @ApiBody({ type: RandomImageRecognitionFlashcardTrainingDto })
  @Post('training/random')
  async randomTraining(@Req() req: Request, @Body() dto: RandomImageRecognitionFlashcardTrainingDto) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.imageRecognitionFlashcardService.randomTraining(userId, dto);
  }

  private getPrimaryRole(req: Request) {
    const user = (req as any).user;
    const claims = user?.claims || user || {};
    const groups = Array.isArray(claims['cognito:groups']) ? claims['cognito:groups'] : [];
    const roleClaim = claims['custom:role'] || claims.role || user?.role;
    if (groups.includes(Role.SuperAdmin) || roleClaim === Role.SuperAdmin) return Role.SuperAdmin;
    if (groups.includes(Role.Admin) || roleClaim === Role.Admin) return Role.Admin;
    return typeof roleClaim === 'string' ? roleClaim : undefined;
  }
}
