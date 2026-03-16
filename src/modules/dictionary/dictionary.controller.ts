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
import { DictionaryService } from './dictionary.service';
import { CreateDictionaryCategoryDto } from './dto/create-dictionary-category.dto';
import { UpdateDictionaryCategoryDto } from './dto/update-dictionary-category.dto';
import { ListDictionaryCategoriesDto } from './dto/list-dictionary-categories.dto';
import { CreateDictionaryItemDto } from './dto/create-dictionary-item.dto';
import { UpdateDictionaryItemDto } from './dto/update-dictionary-item.dto';
import { ListDictionaryItemsDto } from './dto/list-dictionary-items.dto';
import { GetDictionaryOptionsBatchDto } from './dto/get-dictionary-options-batch.dto';
import { ReorderDictionaryItemsDto } from './dto/reorder-dictionary-items.dto';
import { ReorderDictionaryCategoriesDto } from './dto/reorder-dictionary-categories.dto';

@ApiTags('Dictionary')
@ApiBearerAuth()
@Controller('dictionary')
export class DictionaryController {
  constructor(private readonly dictionaryService: DictionaryService) {}

  @ApiOperation({ summary: '创建字典分类' })
  @ApiBody({ type: CreateDictionaryCategoryDto })
  @ApiResponse({ status: 200, description: '创建成功' })
  @Post('categories')
  async createCategory(@Req() req: Request, @Body() dto: CreateDictionaryCategoryDto) {
    return this.dictionaryService.createCategory(this.getUserId(req), dto);
  }

  @ApiOperation({ summary: '查询字典分类列表' })
  @ApiQuery({ name: 'bizType', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'keyword', required: false })
  @ApiResponse({ status: 200, description: '返回分类列表' })
  @Get('categories')
  async listCategories(@Req() req: Request, @Query() query: ListDictionaryCategoriesDto) {
    return this.dictionaryService.listCategories(this.getUserId(req), query);
  }

  @ApiOperation({ summary: '查询字典分类详情' })
  @ApiParam({ name: 'categoryId' })
  @Get('categories/:categoryId')
  async getCategory(@Req() req: Request, @Param('categoryId') categoryId: string) {
    return this.dictionaryService.getCategory(this.getUserId(req), categoryId);
  }

  @ApiOperation({ summary: '更新字典分类' })
  @ApiParam({ name: 'categoryId' })
  @ApiBody({ type: UpdateDictionaryCategoryDto })
  @Patch('categories/:categoryId')
  async updateCategory(
    @Req() req: Request,
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateDictionaryCategoryDto,
  ) {
    return this.dictionaryService.updateCategory(this.getUserId(req), categoryId, dto);
  }

  @ApiOperation({ summary: '删除字典分类' })
  @ApiParam({ name: 'categoryId' })
  @Delete('categories/:categoryId')
  async deleteCategory(@Req() req: Request, @Param('categoryId') categoryId: string) {
    return this.dictionaryService.deleteCategory(this.getUserId(req), categoryId);
  }

  @ApiOperation({ summary: '创建字典项' })
  @ApiBody({ type: CreateDictionaryItemDto })
  @Post('items')
  async createItem(@Req() req: Request, @Body() dto: CreateDictionaryItemDto) {
    return this.dictionaryService.createItem(this.getUserId(req), dto);
  }

  @ApiOperation({ summary: '查询字典项列表' })
  @ApiQuery({ name: 'categoryCode', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'keyword', required: false })
  @Get('items')
  async listItems(@Req() req: Request, @Query() query: ListDictionaryItemsDto) {
    return this.dictionaryService.listItems(this.getUserId(req), query);
  }

  @ApiOperation({ summary: '查询字典项详情' })
  @ApiParam({ name: 'itemId' })
  @Get('items/:itemId')
  async getItem(@Req() req: Request, @Param('itemId') itemId: string) {
    return this.dictionaryService.getItem(this.getUserId(req), itemId);
  }

  @ApiOperation({ summary: '更新字典项' })
  @ApiParam({ name: 'itemId' })
  @ApiBody({ type: UpdateDictionaryItemDto })
  @Patch('items/:itemId')
  async updateItem(
    @Req() req: Request,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateDictionaryItemDto,
  ) {
    return this.dictionaryService.updateItem(this.getUserId(req), itemId, dto);
  }

  @ApiOperation({ summary: '删除字典项' })
  @ApiParam({ name: 'itemId' })
  @Delete('items/:itemId')
  async deleteItem(@Req() req: Request, @Param('itemId') itemId: string) {
    return this.dictionaryService.deleteItem(this.getUserId(req), itemId);
  }

  @ApiOperation({ summary: '按分类获取当前可选字典项' })
  @ApiParam({ name: 'categoryCode' })
  @Get('options/:categoryCode')
  async getOptions(@Req() req: Request, @Param('categoryCode') categoryCode: string) {
    return this.dictionaryService.getCategoryOptions(this.getUserId(req), categoryCode);
  }

  @ApiOperation({ summary: '批量获取多个分类 options' })
  @ApiBody({ type: GetDictionaryOptionsBatchDto })
  @Post('options/batch')
  async getBatchOptions(@Req() req: Request, @Body() dto: GetDictionaryOptionsBatchDto) {
    return this.dictionaryService.getBatchCategoryOptions(this.getUserId(req), dto);
  }

  @ApiOperation({ summary: '批量更新字典项排序' })
  @ApiBody({ type: ReorderDictionaryItemsDto })
  @Patch('items/reorder')
  async reorderItems(@Req() req: Request, @Body() dto: ReorderDictionaryItemsDto) {
    return this.dictionaryService.reorderItems(this.getUserId(req), dto);
  }

  @ApiOperation({ summary: '批量更新字典分类排序' })
  @ApiBody({ type: ReorderDictionaryCategoriesDto })
  @Patch('categories/reorder')
  async reorderCategories(@Req() req: Request, @Body() dto: ReorderDictionaryCategoriesDto) {
    return this.dictionaryService.reorderCategories(this.getUserId(req), dto);
  }

  private getUserId(req: Request) {
    const userId = (req as any).user?.sub;
    if (!userId) {
      throw new NotFoundException('用户信息异常');
    }
    return userId;
  }
}
