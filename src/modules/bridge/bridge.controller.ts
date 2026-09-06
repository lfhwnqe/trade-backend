import { BridgeHooksService } from './bridge-hooks.service';
import {
  Body,
  Delete,
  Header,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { BridgeGuard } from './bridge-access.service';
import { BridgeService } from './bridge.service';

@ApiTags('Bridge')
@ApiBearerAuth()
@Controller('bridge')
@UseGuards(BridgeGuard)
export class BridgeController {
  constructor(
    private readonly bridge: BridgeService,
    private readonly hooks: BridgeHooksService,
  ) {}
  @Get('hooks')
  @Header('Cache-Control', 'no-store')
  listHooks(@Req() req: any, @Query('cursor') cursor?: string) {
    return this.hooks.list(req.user.sub, cursor);
  }
  @Post('hooks')
  @Header('Cache-Control', 'no-store')
  createHook(@Req() req: any, @Body() body: unknown) {
    return this.hooks.create(req.user.sub, body);
  }
  @Delete('hooks/:hookId')
  revokeHook(@Req() req: any, @Param('hookId') id: string) {
    return this.hooks.revoke(req.user.sub, id);
  }
  @Post('hooks/:hookId/rotate')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  rotateHook(@Req() req: any, @Param('hookId') id: string) {
    return this.hooks.rotate(req.user.sub, id);
  }
  @Get('tasks')
  @ApiOperation({ summary: '查询当前用户未读通知任务' })
  unread(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.bridge.unread(req.user.sub, limit, cursor);
  }
  @Post('tasks/:taskId/read')
  @HttpCode(200)
  @ApiOperation({ summary: '幂等标记自己的通知任务为已读' })
  markRead(@Req() req: any, @Param('taskId') id: string) {
    return this.bridge.markRead(req.user.sub, id);
  }
}

@ApiTags('Bridge')
@Controller('webhook/bridge')
export class BridgeWebhookController {
  constructor(private readonly bridge: BridgeService) {}
  @Post(':triggerToken')
  @HttpCode(200)
  @ApiOperation({
    summary: '接收通知并持久入库；独立 Bridge 来源凭据',
  })
  @ApiConsumes('application/json', 'text/plain')
  @ApiBody({
    schema: {
      oneOf: [
        { type: 'object', additionalProperties: true },
        { type: 'string' },
      ],
    },
  })
  receive(@Param('triggerToken') token: string, @Body() body: unknown) {
    return this.bridge.receive(token, body);
  }
}
