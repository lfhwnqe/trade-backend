import { Module } from '@nestjs/common';
import { ConfigService } from './config.service';
import { CognitoService } from './cognito.service';
import { AuthMiddleware } from './auth.middleware';
import { ApiTokenService } from './api-token.service';
import { RolesGuard } from '../../base/guards/roles.guard';

@Module({
  providers: [
    ConfigService,
    CognitoService,
    ApiTokenService,
    AuthMiddleware,
    RolesGuard,
  ],
  exports: [
    ConfigService,
    CognitoService,
    ApiTokenService,
    AuthMiddleware,
    RolesGuard,
  ],
})
export class CommonModule {}
