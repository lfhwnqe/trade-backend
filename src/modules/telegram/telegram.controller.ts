import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { TelegramService } from './telegram.service';
import {
  AuthenticationException,
  ValidationException,
} from '../../base/exceptions/custom.exceptions';
import { ERROR_CODES } from '../../base/constants/error-codes';
import { TelegramUpdate } from './telegram.types';

@ApiTags('Telegram Integration')
@Controller()
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @ApiOperation({ summary: '获取 telegram 绑定信息' })
  @ApiBearerAuth()
  @Get('user/telegram')
  async getBinding(@Req() req: Request) {
    const userId = (req as any).user?.sub;
    if (!userId) {
      throw new ValidationException(
        'user missing',
        ERROR_CODES.AUTH_TOKEN_MISSING,
        '用户信息异常',
      );
    }
    return this.telegramService.getBinding(userId);
  }

  @ApiOperation({ summary: '生成 telegram 绑定链接（发给 bot /start 使用）' })
  @ApiBearerAuth()
  @Post('user/telegram/bind')
  @HttpCode(HttpStatus.OK)
  async createBindLink(@Req() req: Request) {
    const userId = (req as any).user?.sub;
    if (!userId) {
      throw new ValidationException(
        'user missing',
        ERROR_CODES.AUTH_TOKEN_MISSING,
        '用户信息异常',
      );
    }
    const payload = this.telegramService.createBindPayload(userId);
    // 用户需要把链接发给 telegram bot，或在 telegram 里打开。
    const botUsername =
      process.env.TELEGRAM_BOT_USERNAME || 'YOUR_BOT_USERNAME';
    const url = `https://t.me/${botUsername}?start=${payload}`;
    return { success: true, data: { url, startParam: payload } };
  }

  // Telegram webhook (must be excluded from AuthMiddleware)
  @ApiOperation({ summary: 'Telegram bot webhook (bind via /start payload)' })
  @Post('webhook/telegram')
  @HttpCode(HttpStatus.OK)
  async telegramWebhook(
    @Headers('x-telegram-bot-api-secret-token') secret: string | undefined,
    @Body() update: TelegramUpdate,
  ) {
    const expected = this.telegramService.getWebhookSecret();
    if (!secret || secret !== expected) {
      throw new AuthenticationException(
        'Telegram webhook secret mismatch',
        ERROR_CODES.AUTH_UNAUTHORIZED,
        '未授权',
      );
    }

    const text = update?.message?.text || '';
    const chatId = update?.message?.chat?.id;
    const fromId = update?.message?.from?.id;
    const username = update?.message?.from?.username;

    if (!chatId || typeof chatId !== 'number') {
      return { success: true };
    }

    const normalizeCommand = (t: string) => {
      const first = t.trim().split(/\s+/)[0] || '';
      // /bind or /bind@MyBot
      return first.split('@')[0];
    };

    // Expect: /start <payload> (private chat)
    if (typeof text === 'string' && normalizeCommand(text) === '/start') {
      const parts = text.trim().split(/\s+/);
      const startParam = parts[1] || '';
      const verified = this.telegramService.verifyBindPayload(startParam);
      if (!verified) {
        // Best effort feedback
        await this.telegramService
          .sendMessage(
            chatId,
            '绑定失败：链接无效或已过期。请在网页端重新生成绑定链接。',
          )
          .catch(() => undefined);
        return { success: true };
      }

      await this.telegramService.upsertBinding({
        userId: verified.userId,
        chatId,
        telegramUserId: typeof fromId === 'number' ? fromId : undefined,
        telegramUsername: typeof username === 'string' ? username : undefined,
      });

      await this.telegramService
        .sendMessage(chatId, '绑定成功：后续系统会把交易提醒推送到这里。')
        .catch(() => undefined);

      return { success: true };
    }

    // Expect: /bind <bindCode> (group chat)
    if (typeof text === 'string' && normalizeCommand(text) === '/bind') {
      const parts = text.trim().split(/\s+/);
      const bindCode = parts[1] || '';
      if (!bindCode) {
        await this.telegramService
          .sendMessage(chatId, '绑定失败：缺少 bindCode。请从网页复制绑定码。')
          .catch(() => undefined);
        return { success: true };
      }

      const verified = this.telegramService.verifyHookBindCode(bindCode);
      if (!verified) {
        await this.telegramService
          .sendMessage(chatId, '绑定失败：bindCode 无效。请从网页重新生成。')
          .catch(() => undefined);
        return { success: true };
      }

      await this.telegramService.bindHookToChat({
        userId: verified.userId,
        hookId: verified.hookId,
        chatId,
        chatType: update?.message?.chat?.type,
        chatTitle:
          update?.message?.chat?.title || update?.message?.chat?.username,
      });

      await this.telegramService
        .sendMessage(
          chatId,
          `绑定成功：该群已绑定到 webhook（hookId=${verified.hookId}）。`,
        )
        .catch(() => undefined);

      return { success: true };
    }

    return { success: true };
  }

  // Generic webhook to trigger telegram notify
  @ApiOperation({
    summary: 'Trade alert webhook -> send message to bound telegram',
  })
  @Post('webhook/trade-alert')
  @HttpCode(HttpStatus.OK)
  async tradeAlertWebhook(
    @Headers('x-webhook-secret') secret: string | undefined,
    @Body() body: { userId?: string; message?: string },
  ) {
    const expected = process.env.WEBHOOK_SECRET;
    if (!expected) {
      throw new AuthenticationException(
        'WEBHOOK_SECRET not configured',
        ERROR_CODES.SYSTEM_SERVICE_UNAVAILABLE,
        '服务未配置 WEBHOOK_SECRET',
      );
    }
    if (!secret || secret !== expected) {
      throw new AuthenticationException(
        'Webhook secret mismatch',
        ERROR_CODES.AUTH_UNAUTHORIZED,
        '未授权',
      );
    }

    const userId = body?.userId?.trim();
    const message = body?.message;
    if (!userId || typeof message !== 'string' || message.trim().length === 0) {
      throw new ValidationException(
        'userId/message required',
        ERROR_CODES.VALIDATION_REQUIRED_FIELD,
        '缺少 userId 或 message',
      );
    }

    const binding = await this.telegramService.getBinding(userId);
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
