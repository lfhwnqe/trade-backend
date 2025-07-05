/**
 * MindMap控制器
 * 处理脑图相关的HTTP请求
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  Logger,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { MindMapService } from './mindmap.service';
import {
  CreateMindMapDto,
  UpdateMindMapDto,
  MindMapQueryDto,
  MindMapResponseDto,
  MindMapListResponseDto,
  SuccessResponseDto,
  ErrorResponseDto,
} from './dto';

@Controller('api/mindmap')
@UsePipes(new ValidationPipe({ transform: true }))
export class MindMapController {
  private readonly logger = new Logger(MindMapController.name);

  constructor(private readonly mindMapService: MindMapService) {
    this.logger.log('MindMapController initialized');
  }

  /**
   * 创建新的脑图
   * POST /api/mindmap
   */
  @Post()
  async createMindMap(
    @Body() createMindMapDto: CreateMindMapDto,
    @Request() req: any
  ): Promise<MindMapResponseDto> {
    this.logger.log('POST /api/mindmap - Creating new mind map');

    try {
      // 获取用户ID，优先使用JWT token中的用户ID，否则使用固定的匿名用户ID
      const userId = req.user?.sub || 'anonymous-user';
      this.logger.log(`Creating mind map for user: ${userId} (authenticated: ${!!req.user})`);

      const mindMapData = await this.mindMapService.createMindMap(userId, createMindMapDto);

      return MindMapResponseDto.success(mindMapData, 'Mind map created successfully');
    } catch (error) {
      this.logger.error(`Failed to create mind map: ${error.message}`, error.stack);
      return MindMapResponseDto.error(error.message);
    }
  }

  /**
   * 获取指定ID的脑图
   * GET /api/mindmap/:id
   */
  @Get(':id')
  async getMindMapById(
    @Param('id') id: string,
    @Request() req: any
  ): Promise<MindMapResponseDto> {
    this.logger.log(`GET /api/mindmap/${id} - Getting mind map by ID`);

    try {
      // 获取用户ID，优先使用JWT token中的用户ID，否则使用固定的匿名用户ID
      const userId = req.user?.sub || 'anonymous-user';
      this.logger.log(`Getting mind map for user: ${userId} (authenticated: ${!!req.user})`);

      const mindMapData = await this.mindMapService.getMindMapById(userId, id);

      return MindMapResponseDto.success(mindMapData, 'Mind map retrieved successfully');
    } catch (error) {
      this.logger.error(`Failed to get mind map: ${error.message}`, error.stack);
      return MindMapResponseDto.error(error.message);
    }
  }

  /**
   * 更新指定ID的脑图
   * PUT /api/mindmap/:id
   */
  @Put(':id')
  async updateMindMap(
    @Param('id') id: string,
    @Body() updateMindMapDto: UpdateMindMapDto,
    @Request() req: any
  ): Promise<MindMapResponseDto> {
    this.logger.log(`PUT /api/mindmap/${id} - Updating mind map`);
    
    try {
      // 获取用户ID，优先使用JWT token中的用户ID，否则使用固定的匿名用户ID
      const userId = req.user?.sub || 'anonymous-user';
      
      const mindMapData = await this.mindMapService.updateMindMap(userId, id, updateMindMapDto);
      
      return MindMapResponseDto.success(mindMapData, 'Mind map updated successfully');
    } catch (error) {
      this.logger.error(`Failed to update mind map: ${error.message}`, error.stack);
      return MindMapResponseDto.error(error.message);
    }
  }

  /**
   * 删除指定ID的脑图
   * DELETE /api/mindmap/:id
   */
  @Delete(':id')
  async deleteMindMap(
    @Param('id') id: string,
    @Request() req: any
  ): Promise<SuccessResponseDto> {
    this.logger.log(`DELETE /api/mindmap/${id} - Deleting mind map`);
    
    try {
      // 获取用户ID，优先使用JWT token中的用户ID，否则使用固定的匿名用户ID
      const userId = req.user?.sub || 'anonymous-user';
      
      await this.mindMapService.deleteMindMap(userId, id);
      
      return SuccessResponseDto.create(null, 'Mind map deleted successfully');
    } catch (error) {
      this.logger.error(`Failed to delete mind map: ${error.message}`, error.stack);
      return ErrorResponseDto.create(error.message) as any;
    }
  }

  /**
   * 获取用户的脑图列表
   * GET /api/mindmap
   */
  @Get()
  async getMindMapList(
    @Query() queryDto: MindMapQueryDto,
    @Request() req: any
  ): Promise<MindMapListResponseDto> {
    this.logger.log('GET /api/mindmap - Getting mind map list');
    
    try {
      // 获取用户ID，优先使用JWT token中的用户ID，否则使用固定的匿名用户ID
      const userId = req.user?.sub || 'anonymous-user';
      
      const result = await this.mindMapService.getMindMapList(userId, queryDto);
      
      return MindMapListResponseDto.success(
        result.items,
        result.total,
        result.page,
        result.pageSize,
        'Mind map list retrieved successfully'
      );
    } catch (error) {
      this.logger.error(`Failed to get mind map list: ${error.message}`, error.stack);
      return MindMapListResponseDto.error(error.message);
    }
  }

  /**
   * 健康检查端点
   * GET /api/mindmap/health
   */
  @Get('health')
  async healthCheck(): Promise<SuccessResponseDto> {
    this.logger.log('GET /api/mindmap/health - Health check');
    
    try {
      const healthStatus = await this.mindMapService.getHealthStatus();
      return SuccessResponseDto.create(healthStatus, 'MindMap service is healthy');
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`, error.stack);
      return ErrorResponseDto.create('MindMap service is unhealthy') as any;
    }
  }

  /**
   * 获取支持的布局类型
   * GET /api/mindmap/layouts
   */
  @Get('layouts')
  async getSupportedLayouts(): Promise<SuccessResponseDto> {
    this.logger.log('GET /api/mindmap/layouts - Getting supported layouts');
    
    const layouts = [
      { key: 'logicalStructure', name: '逻辑结构图' },
      { key: 'logicalStructureLeft', name: '逻辑结构图（左侧）' },
      { key: 'mindMap', name: '思维导图' },
      { key: 'catalogOrganization', name: '目录组织图' },
      { key: 'organizationStructure', name: '组织结构图' },
      { key: 'timeline', name: '时间轴' },
      { key: 'timeline2', name: '时间轴2' },
      { key: 'fishbone', name: '鱼骨图' },
      { key: 'fishbone2', name: '鱼骨图2' },
      { key: 'rightFishbone', name: '右侧鱼骨图' },
      { key: 'rightFishbone2', name: '右侧鱼骨图2' },
      { key: 'verticalTimeline', name: '垂直时间轴' },
      { key: 'verticalTimeline2', name: '垂直时间轴2' },
      { key: 'verticalTimeline3', name: '垂直时间轴3' },
    ];
    
    return SuccessResponseDto.create(layouts, 'Supported layouts retrieved successfully');
  }

  /**
   * 获取支持的主题类型
   * GET /api/mindmap/themes
   */
  @Get('themes')
  async getSupportedThemes(): Promise<SuccessResponseDto> {
    this.logger.log('GET /api/mindmap/themes - Getting supported themes');
    
    const themes = [
      { key: 'default', name: '默认主题' },
      { key: 'classic', name: '经典主题' },
      { key: 'dark', name: '暗色主题' },
      { key: 'blueSky', name: '蓝天主题' },
      { key: 'freshGreen', name: '清新绿' },
      { key: 'romanticPurple', name: '浪漫紫' },
    ];
    
    return SuccessResponseDto.create(themes, 'Supported themes retrieved successfully');
  }
}
