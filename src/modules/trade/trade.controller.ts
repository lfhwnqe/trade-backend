import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  NotFoundException,
  Query,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { TradeService } from './trade.service';
import { CreateTradeDto } from './dto/create-trade.dto';
import { UpdateTradeDto } from './dto/update-trade.dto';
import { Request } from 'express';
import { UpdateShareableDto } from './dto/share-trade.dto';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { TradeQueryDto } from './dto/trade-query.dto';
import { TradeImageUploadUrlDto } from './dto/trade-image-upload.dto';
import { ResolveTradeImagesDto } from './dto/resolve-trade-images.dto';
import { ImageService } from '../image/image.service';
import { WebhookService } from '../webhook/webhook.service';

@ApiTags('交易管理')
@ApiBearerAuth()
@Controller('trade')
export class TradeController {
  constructor(
    private readonly tradeService: TradeService,
    private readonly imageService: ImageService,
    private readonly webhookService: WebhookService,
  ) {}
  // 首页统计 GET /trade/stats
  @ApiOperation({ summary: '获取本月已离场交易数和胜率' })
  @ApiResponse({ status: 200, description: '统计数据获取成功' })
  @Get('stats')
  async getStats(@Req() req: Request) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    const data = await this.tradeService.getThisMonthStats(userId);
    return { success: true, data };
  }

  @ApiOperation({ summary: '获取交易仪表盘数据' })
  @ApiResponse({ status: 200, description: '仪表盘数据获取成功' })
  @Get('dashboard')
  async getDashboard(@Req() req: Request) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    const result = await this.tradeService.getDashboardData(userId);
    return result;
  }

  @ApiOperation({ summary: '获取最近时间段交易胜率趋势' })
  @ApiQuery({
    name: 'range',
    required: false,
    description: '时间范围: 7d | 30d | 3m',
    example: '7d',
  })
  @ApiResponse({ status: 200, description: '胜率趋势获取成功' })
  @Get('win-rate')
  async getWinRateTrend(@Req() req: Request, @Query('range') range?: string) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    const normalizedRange = range ?? '7d';
    if (!['7d', '30d', '3m'].includes(normalizedRange)) {
      throw new BadRequestException('range 参数不合法');
    }
    const result = await this.tradeService.getWinRateTrend(
      userId,
      normalizedRange as '7d' | '30d' | '3m',
    );
    return result;
  }

  // ============ Trade-scoped Image ============
  @ApiOperation({ summary: '迁移历史公开图片引用为 key（按当前用户）' })
  @ApiQuery({ name: 'limit', required: false, description: '扫描交易上限，默认200，最大2000' })
  @ApiQuery({ name: 'dryRun', required: false, description: '是否仅预览，默认 true' })
  @ApiResponse({ status: 200, description: '返回迁移统计' })
  @Post('image/migrate-legacy')
  async migrateLegacyImageRefs(@Req() req: Request) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');

    const limitRaw = (req.query.limit as string) || '200';
    const limit = Number(limitRaw);
    const dryRunRaw = String(req.query.dryRun ?? 'true').toLowerCase();
    const dryRun = dryRunRaw !== 'false';

    return this.tradeService.migrateLegacyImageRefs(userId, {
      limit: Number.isFinite(limit) ? limit : 200,
      dryRun,
    });
  }

  @ApiOperation({
    summary: '解析交易图片引用（兼容 legacy 公链 + 私有 key）',
  })
  @ApiBody({ type: ResolveTradeImagesDto })
  @ApiResponse({ status: 200, description: '返回可访问图片 URL 列表' })
  @Post('image/resolve')
  async resolveTradeImages(
    @Req() req: Request,
    @Body() body: ResolveTradeImagesDto,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');

    return this.imageService.resolveTradeImageRefs(userId, body.refs || []);
  }

  @ApiOperation({
    summary: '获取交易截图上传URL（trade 域内，给 API token 使用）',
  })
  @ApiBody({ type: TradeImageUploadUrlDto })
  @ApiResponse({ status: 200, description: '返回上传URL和key' })
  @Post('image/upload-url')
  async getTradeImageUploadUrl(
    @Req() req: Request,
    @Body() body: TradeImageUploadUrlDto,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');

    const authType = String((req as any).authType || '');
    if (!body.transactionId) {
      throw new BadRequestException('上传图片必须传 transactionId');
    }

    const trade = await this.tradeService.getTrade(userId, body.transactionId);
    const isApiToken = authType === 'apiToken';
    const isDraftCreateFlow =
      !isApiToken && !trade?.success && String(body.source || 'trade') === 'trade';
    if (!trade?.success && !isDraftCreateFlow) {
      throw new NotFoundException('transactionId 对应交易不存在或无权限');
    }

    await this.imageService.consumeUploadQuota({
      userId,
      claims: (req as any).user,
      authType,
      apiTokenId: (req as any).apiTokenId,
      contentLength: body.contentLength,
    });

    return this.imageService.generateTradeUploadUrl(userId, {
      fileName: body.fileName,
      fileType: body.fileType,
      date: body.date,
      transactionId: body.transactionId,
      contentLength: body.contentLength,
      source: body.source,
    });
  }

  // 创建交易记录
  @ApiOperation({ summary: '创建交易记录' })
  @ApiBody({ type: CreateTradeDto })
  @ApiResponse({ status: 201, description: '创建成功' })
  @Post()
  async create(@Req() req: Request, @Body() dto: CreateTradeDto) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    const result = await this.tradeService.createTrade(userId, dto);
    return result;
  }

  // 分享交易（生成分享ID并设置为可分享）
  @ApiOperation({ summary: '分享交易（生成分享ID）' })
  @ApiParam({ name: 'transactionId', description: '交易ID' })
  @ApiResponse({ status: 200, description: '分享成功' })
  @Post(':transactionId/share')
  async shareTrade(
    @Req() req: Request,
    @Param('transactionId') transactionId: string,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    const result = await this.tradeService.shareTrade(userId, transactionId);
    return result;
  }

  // 设置交易是否可分享
  @ApiOperation({ summary: '设置交易是否可分享' })
  @ApiParam({ name: 'transactionId', description: '交易ID' })
  @ApiBody({ type: UpdateShareableDto })
  @ApiResponse({ status: 200, description: '更新成功' })
  @Patch(':transactionId/shareable')
  async updateShareable(
    @Req() req: Request,
    @Param('transactionId') transactionId: string,
    @Body() dto: UpdateShareableDto,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    const result = await this.tradeService.updateShareable(
      userId,
      transactionId,
      dto.isShareable,
    );
    return result;
  }

  // 分享查看（非本用户订单）
  @ApiOperation({ summary: '通过分享ID查看交易（非本用户订单）' })
  @ApiParam({ name: 'shareId', description: '分享ID' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @Get('shared/:shareId')
  async getSharedTrade(@Req() req: Request, @Param('shareId') shareId: string) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    const result = await this.tradeService.getSharedTradeByShareId(shareId);
    return result;
  }

  // 查询单条记录
  @ApiOperation({ summary: '查询单条交易记录' })
  @ApiParam({ name: 'transactionId', description: '交易ID' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @Get(':transactionId')
  async findOne(
    @Req() req: Request,
    @Param('transactionId') transactionId: string,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    const result = await this.tradeService.getTrade(userId, transactionId);
    return result;
  }

  // 查询用户全部
  @ApiOperation({ summary: '查询用户所有交易记录' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @Get('list')
  async findAll(@Req() req: Request) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    // 默认第一页20条，可用query传递
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const pageSize = req.query.pageSize
      ? parseInt(String(req.query.pageSize), 10)
      : 20;
    const result = await this.tradeService.findByUserId(userId, page, pageSize);
    return result;
  }

  @ApiOperation({ summary: '分页获取交易事前总结' })
  @ApiQuery({ name: 'page', required: false, description: '页码，默认1' })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    description: '每页数量，默认20，最大100',
  })
  @ApiResponse({ status: 200, description: '获取成功' })
  @Post('summaries/pre')
  async getPreEntrySummaries(@Req() req: Request) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');

    let page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    if (Number.isNaN(page) || page < 1) page = 1;
    let pageSize = req.query.pageSize
      ? parseInt(String(req.query.pageSize), 10)
      : 20;
    if (Number.isNaN(pageSize) || pageSize < 1) pageSize = 20;
    const cappedPageSize = Math.min(pageSize, 100);

    const result = await this.tradeService.getPreEntrySummaries(
      userId,
      page,
      cappedPageSize,
    );
    return result;
  }

  @ApiOperation({ summary: '分页获取交易事后总结' })
  @ApiQuery({ name: 'page', required: false, description: '页码，默认1' })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    description: '每页数量，默认20，最大100',
  })
  @ApiResponse({ status: 200, description: '获取成功' })
  @Post('summaries/post')
  async getPostTradeSummaries(@Req() req: Request) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');

    let page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    if (Number.isNaN(page) || page < 1) page = 1;
    let pageSize = req.query.pageSize
      ? parseInt(String(req.query.pageSize), 10)
      : 20;
    if (Number.isNaN(pageSize) || pageSize < 1) pageSize = 20;
    const cappedPageSize = Math.min(pageSize, 100);

    const result = await this.tradeService.getPostTradeSummaries(
      userId,
      page,
      cappedPageSize,
    );
    return result;
  }

  @ApiOperation({ summary: '随机获取五星交易总结（事前/事后）' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @Post('summaries/random')
  async getRandomFiveStarSummaries(@Req() req: Request) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    const result = await this.tradeService.getRandomFiveStarSummaries(userId);
    return result;
  }
  // 新增：POST 方式的 list
  @ApiOperation({ summary: '查询用户所有交易记录(POST方式)' })
  @ApiBody({
    schema: {
      properties: {
        page: { type: 'number', example: 1 },
        pageSize: { type: 'number', example: 20 },
        marketStructure: {
          type: 'string',
          example: '震荡',
          description: '市场结构',
        },
        entryDirection: {
          type: 'string',
          example: '多',
          description: '交易方向',
        },
        tradeStatus: {
          type: 'string',
          example: '已离场',
          description: '交易状态',
        },
        grade: {
          type: 'string',
          enum: ['高', '中', '低'],
          example: '高',
          description: '交易分级',
        },
        analysisExpired: {
          type: 'boolean',
          example: false,
          description: '分析是否过期',
        },
        analysisPeriod: {
          type: 'string',
          example: '1小时',
          description:
            '分析周期（15分钟/30分钟/1小时/4小时/1天，也支持自定义）',
        },
        dateFrom: {
          type: 'string',
          example: '2025-01-01',
          description: '开始日期',
        },
        dateTo: {
          type: 'string',
          example: '2025-05-29',
          description: '结束日期',
        },
        tradeResult: {
          type: 'string',
          example: 'PROFIT',
          description: '交易结果',
        },
        followedSystemStrictly: {
          type: 'boolean',
          example: true,
          description: '是否严格遵守交易系统',
        },
        tradeTags: {
          type: 'array',
          items: { type: 'string' },
          example: ['突破', '趋势跟随'],
          description: '交易标签（用户自定义）',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: '查询成功' })
  @Post('list')
  async findAllPost(@Body() dto: TradeQueryDto, @Req() req: Request) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    const result = await this.tradeService.findByUserQuery(userId, dto);
    return result;
  }

  // 更新指定交易记录
  @ApiOperation({ summary: '更新交易记录' })
  @ApiParam({ name: 'transactionId', description: '交易ID' })
  @ApiBody({ type: UpdateTradeDto })
  @ApiResponse({ status: 200, description: '更新成功' })
  @Patch(':transactionId')
  async update(
    @Req() req: Request,
    @Param('transactionId') transactionId: string,
    @Body() dto: UpdateTradeDto,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    const result = await this.tradeService.updateTrade(
      userId,
      transactionId,
      dto,
    );
    return result;
  }

  // 删除指定交易记录
  @ApiOperation({ summary: '删除交易记录' })
  @ApiParam({ name: 'transactionId', description: '交易ID' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @Delete(':transactionId')
  async remove(
    @Req() req: Request,
    @Param('transactionId') transactionId: string,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');

    // API Token 允许 read/write，但禁止 delete
    if ((req as any).authType === 'apiToken') {
      throw new ForbiddenException('API token 无权删除交易记录');
    }

    const result = await this.tradeService.deleteTrade(userId, transactionId);
    return result;
  }

  // 复制交易记录
  @ApiOperation({ summary: '复制交易记录' })
  @ApiParam({ name: 'transactionId', description: '要复制的交易ID' })
  @ApiResponse({ status: 201, description: '复制成功' })
  @Post(':transactionId/copy')
  async copyTrade(
    @Req() req: Request,
    @Param('transactionId') transactionId: string,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');
    const result = await this.tradeService.copyTrade(userId, transactionId);
    return result;
  }

  // =========================
  // Trade webhook (1 trade = 1 webhook)
  // =========================

  @ApiOperation({ summary: '为该 Trade 创建 webhook（1 trade = 1 webhook）' })
  @ApiParam({ name: 'transactionId', description: '交易ID' })
  @ApiResponse({ status: 201, description: '创建成功（secret 仅返回一次）' })
  @Post(':transactionId/webhook')
  async createTradeWebhook(
    @Req() req: Request,
    @Param('transactionId') transactionId: string,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');

    // quota by role
    const claims = (req as any).user?.claims || (req as any).user;
    const role = String(claims?.['custom:role'] || claims?.role || '');
    const groups: string[] =
      (claims?.['cognito:groups'] as string[]) ||
      (req as any).user?.groups ||
      [];

    const isAdmin =
      role === 'Admins' ||
      role === 'SuperAdmins' ||
      groups.includes('Admins') ||
      groups.includes('SuperAdmins');
    const isPro = role === 'ProPlan';

    const activeCount = await this.webhookService.countActiveHooks(userId);
    const limit = isAdmin ? 5 : isPro ? 1 : 0;

    if (limit === 0) {
      throw new ForbiddenException('Free 用户无法创建 webhook，请升级 Pro');
    }
    if (activeCount >= limit) {
      throw new ForbiddenException(
        isPro
          ? 'Pro 用户最多创建 1 个 webhook'
          : 'Admin 用户最多创建 5 个 webhook',
      );
    }

    // ensure trade exists & shortId exists
    const tradeRes = await this.tradeService.getTrade(userId, transactionId);
    const trade = tradeRes?.data as any;
    const tradeShortId =
      trade?.tradeShortId ||
      (await this.tradeService.ensureTradeShortId(userId, transactionId));

    if (!tradeShortId) {
      throw new BadRequestException('tradeShortId 生成失败');
    }

    const hook = await this.webhookService.createHookForTrade({
      userId,
      tradeTransactionId: transactionId,
      tradeShortId,
      name: trade?.tradeSubject
        ? `trade:${trade.tradeSubject}`
        : 'trade-webhook',
    });

    return { success: true, data: hook };
  }

  @ApiOperation({ summary: '查看该 Trade 的 webhook 状态' })
  @ApiParam({ name: 'transactionId', description: '交易ID' })
  @Get(':transactionId/webhook')
  async getTradeWebhook(
    @Req() req: Request,
    @Param('transactionId') transactionId: string,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');

    // ensure trade exists
    await this.tradeService.getTrade(userId, transactionId);

    const hook = await this.webhookService.findActiveHookByTrade(
      userId,
      transactionId,
    );

    if (!hook) {
      return { success: true, data: { exists: false } };
    }

    const { secretHash: _ignoreSecretHash, ...publicHook } = hook as any;
    void _ignoreSecretHash;
    return {
      success: true,
      data: {
        exists: true,
        hook: {
          ...publicHook,
          triggerUrl:
            publicHook.triggerToken && publicHook.tradeShortId
              ? this.webhookService.buildTradingViewTriggerUrlForTrade(
                  publicHook.triggerToken,
                  publicHook.tradeShortId,
                )
              : publicHook.triggerToken
                ? this.webhookService.buildTradingViewTriggerUrl(
                    publicHook.triggerToken,
                  )
                : undefined,
        },
      },
    };
  }

  @ApiOperation({ summary: '删除/撤销该 Trade 的 webhook' })
  @ApiParam({ name: 'transactionId', description: '交易ID' })
  @Delete(':transactionId/webhook')
  async deleteTradeWebhook(
    @Req() req: Request,
    @Param('transactionId') transactionId: string,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new NotFoundException('用户信息异常');

    // ensure trade exists
    await this.tradeService.getTrade(userId, transactionId);

    const hook = await this.webhookService.findActiveHookByTrade(
      userId,
      transactionId,
    );

    if (!hook) {
      return { success: true, data: { deleted: false } };
    }

    await this.webhookService.revokeHook(userId, hook.hookId);
    return { success: true, data: { deleted: true } };
  }
}
