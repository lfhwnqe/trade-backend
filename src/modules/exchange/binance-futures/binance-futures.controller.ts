import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  ForbiddenException,
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

  @ApiOperation({
    summary: '手动触发：导入最近 1 年 Binance 合约成交记录（fills）',
  })
  @ApiResponse({ status: 200 })
  @Post('import')
  async import(@Req() req: Request, @Body() body: ImportBinanceFuturesDto) {
    this.requireCognito(req);
    const userId = (req as any).user?.sub;
    return this.binance.importLastYearFills(userId, body.symbols);
  }
}
