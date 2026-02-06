import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { WebhookService } from './webhook.service';
import {
  AuthenticationException,
  ValidationException,
} from '../../base/exceptions/custom.exceptions';
import { ERROR_CODES } from '../../base/constants/error-codes';
import { TelegramService } from '../telegram/telegram.service';

@ApiTags('Webhook')
@Controller()
export class WebhookController {
  constructor(
    private readonly webhookService: WebhookService,
    private readonly telegramService: TelegramService,
  ) {}

  // =========================
  // User: manage hooks (login)
  // =========================

  @ApiOperation({ summary: '创建用户 webhook hook（仅返回一次 secret）' })
  @ApiBearerAuth()
  @Post('user/webhooks')
  @HttpCode(HttpStatus.CREATED)
  async createHook(@Req() req: Request, @Body() body: { name?: string }) {
    const userId = (req as any).user?.sub;
    if (!userId) {
      throw new ValidationException(
        'user missing',
        ERROR_CODES.AUTH_TOKEN_MISSING,
        '用户信息异常',
      );
    }
    const result = await this.webhookService.createHook(userId, body?.name);
    return { success: true, data: result };
  }

  @ApiOperation({ summary: '分页列出用户 webhook hooks（不返回 secret）' })
  @ApiBearerAuth()
  @Get('user/webhooks')
  @HttpCode(HttpStatus.OK)
  async listHooks(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new Error('用户信息异常');
    const numericLimit = limit ? Math.max(1, Math.min(50, Number(limit))) : 20;
    const startKey = this.webhookService.decodeCursor(cursor);
    return this.webhookService.listHooks(userId, numericLimit, startKey);
  }

  @ApiOperation({ summary: '撤销 webhook hook' })
  @ApiBearerAuth()
  @Delete('user/webhooks/:hookId')
  @HttpCode(HttpStatus.OK)
  async revokeHook(@Req() req: Request, @Param('hookId') hookId: string) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new Error('用户信息异常');
    if (!hookId) throw new Error('hookId required');
    return this.webhookService.revokeHook(userId, hookId);
  }

  // =========================
  // Public: trigger hook
  // =========================

  @ApiOperation({
    summary:
      'Trade alert webhook (by hookId) -> send message to user configured telegram chats',
  })
  @Post('webhook/trade-alert/:hookId')
  @HttpCode(HttpStatus.OK)
  async tradeAlertWebhook(
    @Param('hookId') hookId: string,
    @Headers('x-webhook-secret') secret: string | undefined,
    @Body() body: { message?: string },
  ) {
    const message = body?.message;
    if (!hookId) {
      throw new ValidationException(
        'hookId required',
        ERROR_CODES.VALIDATION_REQUIRED_FIELD,
        '缺少 hookId',
      );
    }
    if (!secret) {
      throw new AuthenticationException(
        'Webhook secret missing',
        ERROR_CODES.AUTH_UNAUTHORIZED,
        '未授权',
      );
    }
    if (typeof message !== 'string' || message.trim().length === 0) {
      throw new ValidationException(
        'message required',
        ERROR_CODES.VALIDATION_REQUIRED_FIELD,
        '缺少 message',
      );
    }

    const auth = await this.webhookService.authenticateHook(hookId, secret);
    if (!auth) {
      throw new AuthenticationException(
        'Webhook secret mismatch',
        ERROR_CODES.AUTH_UNAUTHORIZED,
        '未授权',
      );
    }

    // TODO: send to configured chats (group/private). For now use existing single binding.
    const binding = await this.telegramService.getBinding(auth.userId);
    const data = binding.data;
    if (!data?.chatId) {
      return {
        success: true,
        data: { delivered: false, reason: 'telegram not bound' },
      };
    }

    await this.telegramService.sendMessage(data.chatId, message);
    return { success: true, data: { delivered: true } };
  }
}
