import { Module } from '@nestjs/common';
import { ConfigService } from './config.service';
import { CognitoService } from './cognito.service';
import { AuthMiddleware } from './auth.middleware';
import { RolesGuard } from '../../base/guards/roles.guard';

@Module({
  providers: [ConfigService, CognitoService, AuthMiddleware, RolesGuard],
  exports: [ConfigService, CognitoService, AuthMiddleware, RolesGuard],
})
export class CommonModule {}
