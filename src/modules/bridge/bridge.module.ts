import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { BridgeHooksService } from './bridge-hooks.service';
import { BridgeAccessService, BridgeGuard } from './bridge-access.service';
import { BridgeController, BridgeWebhookController } from './bridge.controller';
import { BridgeService } from './bridge.service';

@Module({
  imports: [CommonModule],
  controllers: [BridgeController, BridgeWebhookController],
  providers: [
    BridgeAccessService,
    BridgeGuard,
    BridgeService,
    BridgeHooksService,
  ],
})
export class BridgeModule {}
