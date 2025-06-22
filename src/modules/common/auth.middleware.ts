import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CognitoService } from './cognito.service';
import { AuthenticationException } from '../../base/exceptions/custom.exceptions';
import { ERROR_CODES } from '../../base/constants/error-codes';

const whitelist = [
  '/user/register',
  '/user/confirm',
  '/user/login',
  '/user/registration/status',
];

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly cognitoService: CognitoService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      if (whitelist.some((pattern) => req.path.startsWith(pattern))) {
        console.log('[AuthMiddleware] 命中白名单，放行');
        return next();
      }
      const cookie = req.headers.cookie || '';
      const token = cookie
        .split(';')
        .map((item) => item.trim())
        .find((item) => item.startsWith('token='))
        ?.split('=')[1];

      if (!token) {
        console.log('[AuthMiddleware] 缺少 token');
        throw new AuthenticationException(
          'Authorization token missing from request',
          ERROR_CODES.AUTH_TOKEN_MISSING,
          '缺少 token，请登录',
        );
      }
      let user = null;
      try {
        user = await this.cognitoService.verifyAccessToken(token);
      } catch (err) {
        console.log(
          '[AuthMiddleware] verifyAccessToken抛出异常:',
          err?.message || err,
        );
      }
      if (!user) {
        console.log('[AuthMiddleware] token校验失败');
        throw new AuthenticationException(
          'JWT token verification failed',
          ERROR_CODES.AUTH_TOKEN_INVALID,
          'token 校验失败',
        );
      }
      (req as any).user = user;
      return next();
    } catch (e: any) {
      console.log('[AuthMiddleware] 总catch捕获到异常:', e?.message || e);
      // 如果已经是我们的自定义异常，直接重新抛出
      if (e instanceof AuthenticationException) {
        throw e;
      }
      // 否则包装为认证验证失败异常
      throw new AuthenticationException(
        'Authentication verification failed',
        ERROR_CODES.AUTH_VERIFICATION_FAILED,
        'token 校验失败',
        { originalError: e?.message || e },
      );
    }
  }
}
