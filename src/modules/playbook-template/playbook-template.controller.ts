import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CreatePlaybookTemplateDto } from './dto/create-playbook-template.dto';
import { GetPlaybookTemplateUploadUrlDto } from './dto/get-playbook-template-upload-url.dto';
import { ListPlaybookTemplatesDto } from './dto/list-playbook-templates.dto';
import { UpdatePlaybookTemplateDto } from './dto/update-playbook-template.dto';
import { PlaybookTemplateService } from './playbook-template.service';

@ApiTags('PlaybookTemplate')
@ApiBearerAuth()
@Controller('playbook-template')
export class PlaybookTemplateController {
  constructor(private readonly playbookTemplateService: PlaybookTemplateService) {}

  @ApiOperation({ summary: '获取剧本模板图片上传 URL' })
  @ApiBody({ type: GetPlaybookTemplateUploadUrlDto })
  @ApiResponse({ status: 200, description: '返回上传 URL 与文件 URL' })
  @Post('image/upload-url')
  async getUploadUrl(@Req() req: Request, @Body() dto: GetPlaybookTemplateUploadUrlDto) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.playbookTemplateService.getUploadUrl(userId, dto);
  }

  @ApiOperation({ summary: '创建剧本模板' })
  @ApiBody({ type: CreatePlaybookTemplateDto })
  @ApiResponse({ status: 200, description: '创建成功并返回剧本模板' })
  @Post('templates')
  async createTemplate(@Req() req: Request, @Body() dto: CreatePlaybookTemplateDto) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.playbookTemplateService.createTemplate(userId, dto);
  }

  @ApiOperation({ summary: '分页查询剧本模板（管理页）' })
  @ApiQuery({ name: 'pageSize', required: false, example: 20 })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'playbookType', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['ACTIVE', 'DISABLED', 'ALL'] })
  @ApiQuery({ name: 'keyword', required: false })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['CREATED_AT', 'UPDATED_AT', 'SORT_ORDER'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @Get('templates')
  async listTemplates(@Req() req: Request, @Query() query: ListPlaybookTemplatesDto) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.playbookTemplateService.listTemplates(userId, query);
  }

  @ApiOperation({ summary: '按剧本查询交易时查看模板' })
  @ApiParam({ name: 'playbookType', description: '剧本类型编码' })
  @Get('templates/by-playbook/:playbookType')
  async listActiveTemplatesByPlaybook(@Req() req: Request, @Param('playbookType') playbookType: string) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.playbookTemplateService.listActiveTemplatesByPlaybook(userId, playbookType);
  }

  @ApiOperation({ summary: '查询单个剧本模板详情' })
  @ApiParam({ name: 'templateId', description: '剧本模板 ID' })
  @Get('templates/:templateId')
  async getTemplate(@Req() req: Request, @Param('templateId') templateId: string) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.playbookTemplateService.getTemplate(userId, templateId);
  }

  @ApiOperation({ summary: '更新剧本模板' })
  @ApiParam({ name: 'templateId', description: '剧本模板 ID' })
  @ApiBody({ type: UpdatePlaybookTemplateDto })
  @Patch('templates/:templateId')
  async updateTemplate(
    @Req() req: Request,
    @Param('templateId') templateId: string,
    @Body() dto: UpdatePlaybookTemplateDto,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.playbookTemplateService.updateTemplate(userId, templateId, dto);
  }

  @ApiOperation({ summary: '删除剧本模板' })
  @ApiParam({ name: 'templateId', description: '剧本模板 ID' })
  @Delete('templates/:templateId')
  async deleteTemplate(@Req() req: Request, @Param('templateId') templateId: string) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    return this.playbookTemplateService.deleteTemplate(userId, templateId);
  }
}
