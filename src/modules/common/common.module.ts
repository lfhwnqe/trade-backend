import { Module } from '@nestjs/common';
import { ConfigService } from './config.service';
import { CognitoService } from './cognito.service';
import { AuthMiddleware } from './auth.middleware';

@Module({
  providers: [ConfigService, CognitoService, AuthMiddleware],
  exports: [ConfigService, CognitoService, AuthMiddleware],
})
export class CommonModule {}
