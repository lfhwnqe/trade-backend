import { Module } from '@nestjs/common';
import { ConfigService } from './config.service';
import { ApiTokenService } from './api-token.service';

@Module({
  providers: [ConfigService, ApiTokenService],
  exports: [ApiTokenService],
})
export class ApiTokenModule {}
