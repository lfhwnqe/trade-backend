import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  ForbiddenException,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { BinanceFuturesService } from './binance-futures.service';
import { SetBinanceFuturesKeyDto } from './dto/set-binance-futures-key.dto';
import { ImportBinanceFuturesDto } from './dto/import-binance-futures.dto';
import { ListBinanceFuturesFillsDto } from './dto/list-binance-futures-fills.dto';
import { ConvertBinanceFuturesFillsDto } from './dto/convert-binance-futures-fills.dto';
import { ListBinanceFuturesPositionsDto } from './dto/list-binance-futures-positions.dto';
import { ConvertBinanceFuturesPositionsDto } from './dto/convert-binance-futures-positions.dto';
import { CleanupBinanceFuturesDto } from './dto/cleanup-binance-futures.dto';

@ApiTags('交易集成')
@ApiBearerAuth()
@Controller('trade/integrations/binance-futures')
export class BinanceFuturesController {
  constructor(private readonly binance: BinanceFuturesService) {}

  private requireCognito(req: Request) {
    const authType = (req as any).authType;
    if (authType !== 'cognito') {
      throw new ForbiddenException('仅支持登录态操作');
    }
  }

  @ApiOperation({ summary: '查看 Binance 合约 Key 配置状态（不返回明文）' })
  @ApiResponse({ status: 200 })
  @Get('key')
  async getKeyStatus(@Req() req: Request) {
    this.requireCognito(req);
    const userId = (req as any).user?.sub;
    return this.binance.getApiKeyStatus(userId);
  }

  @ApiOperation({ summary: '设置/更新 Binance 合约 API Key（只读权限即可）' })
  @ApiResponse({ status: 200 })
  @Post('key')
  async setKey(@Req() req: Request, @Body() body: SetBinanceFuturesKeyDto) {
    this.requireCognito(req);
    const userId = (req as any).user?.sub;
    return this.binance.upsertApiKey(userId, body.apiKey, body.apiSecret);
  }

  @ApiOperation({ summary: '删除 Binance 合约 API Key' })
  @ApiResponse({ status: 200 })
  @Delete('key')
  async deleteKey(@Req() req: Request) {
    this.requireCognito(req);
    const userId = (req as any).user?.sub;
    return this.binance.deleteApiKey(userId);
  }

  @ApiOperation({ summary: '手动触发：导入 Binance 合约成交记录（fills）' })
  @ApiResponse({ status: 200 })
  @Post('import')
  async import(@Req() req: Request, @Body() body: ImportBinanceFuturesDto) {
    this.requireCognito(req);
    const userId = (req as any).user?.sub;
    return this.binance.importFills(userId, body.symbols, body.range);
  }

  @ApiOperation({ summary: '分页查询：已同步的 Binance 合约成交记录（fills）' })
  @ApiResponse({ status: 200 })
  @Get('fills')
  async listFills(
    @Req() req: Request,
    @Query() query: ListBinanceFuturesFillsDto,
  ) {
    this.requireCognito(req);
    const userId = (req as any).user?.sub;
    return this.binance.listFills(
      userId,
      query.pageSize ?? 50,
      query.nextToken,
    );
  }

  @ApiOperation({ summary: '把选中的 fills 转换为系统 Trade（基础记录）' })
  @ApiResponse({ status: 200 })
  @Post('convert')
  async convert(
    @Req() req: Request,
    @Body() body: ConvertBinanceFuturesFillsDto,
  ) {
    this.requireCognito(req);
    const userId = (req as any).user?.sub;
    return this.binance.convertFillsToTrades(userId, body.tradeKeys);
  }

  @ApiOperation({ summary: '分页查询：已平仓仓位历史（由成交聚合）' })
  @ApiResponse({ status: 200 })
  @Get('positions')
  async listPositions(
    @Req() req: Request,
    @Query() query: ListBinanceFuturesPositionsDto,
  ) {
    this.requireCognito(req);
    const userId = (req as any).user?.sub;
    return this.binance.listPositions(
      userId,
      query.pageSize ?? 20,
      query.nextToken,
      query.range,
    );
  }

  @ApiOperation({ summary: '手动触发：重建已平仓仓位历史（由成交聚合）' })
  @ApiResponse({ status: 200 })
  @Post('positions/rebuild')
  async rebuildPositions(
    @Req() req: Request,
    @Body() body: ImportBinanceFuturesDto,
  ) {
    this.requireCognito(req);
    const userId = (req as any).user?.sub;
    return this.binance.rebuildClosedPositions(userId, body.range);
  }

  @ApiOperation({ summary: '把选中的已平仓仓位转换为系统 Trade（推荐）' })
  @ApiResponse({ status: 200 })
  @Post('positions/convert')
  async convertPositions(
    @Req() req: Request,
    @Body() body: ConvertBinanceFuturesPositionsDto,
  ) {
    this.requireCognito(req);
    const userId = (req as any).user?.sub;
    return this.binance.convertPositionsToTrades(userId, body.positionKeys);
  }

  @ApiOperation({ summary: '清空币安合约同步数据（不影响系统真实交易记录）' })
  @ApiResponse({ status: 200 })
  @Post('cleanup')
  async cleanup(@Req() req: Request, @Body() body: CleanupBinanceFuturesDto) {
    this.requireCognito(req);
    const userId = (req as any).user?.sub;
    return this.binance.cleanupSyncedData(userId, body.includeKeys);
  }
}
