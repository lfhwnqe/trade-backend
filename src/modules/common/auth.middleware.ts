import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CognitoService } from './cognito.service';
import { AuthenticationException } from '../../base/exceptions/custom.exceptions';
import { ERROR_CODES } from '../../base/constants/error-codes';

const whitelist = [
  '/user/register',
  '/user/confirm',
  '/user/login',
  '/user/refresh',
  '/user/registration/status',
];

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly isProd = process.env.APP_ENV === 'prod';
  private readonly accessTokenMaxAgeMs = 60 * 60 * 1000;
  private readonly refreshTokenMaxAgeMs = 30 * 24 * 60 * 60 * 1000;

  constructor(private readonly cognitoService: CognitoService) {}

  private getCookieValue(req: Request, name: string): string | undefined {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return undefined;
    const cookie = cookieHeader
      .split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${name}=`));
    return cookie?.split('=')[1];
  }

  private setAuthCookies(
    res: Response,
    tokens: { accessToken: string; refreshToken: string; idToken: string },
  ) {
    const baseOptions = {
      httpOnly: true,
      secure: this.isProd,
      sameSite: 'lax' as const,
      path: '/',
    };

    res.cookie('token', tokens.accessToken, {
      ...baseOptions,
      maxAge: this.accessTokenMaxAgeMs,
    });
    res.cookie('refreshToken', tokens.refreshToken, {
      ...baseOptions,
      maxAge: this.refreshTokenMaxAgeMs,
    });
    res.cookie('idToken', tokens.idToken, {
      ...baseOptions,
      maxAge: this.accessTokenMaxAgeMs,
    });
  }

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      if (whitelist.some((pattern) => req.path.startsWith(pattern))) {
        console.log('[AuthMiddleware] 命中白名单，放行');
        return next();
      }
      const token = this.getCookieValue(req, 'token');

      if (!token) {
        console.log('[AuthMiddleware] 缺少 token');
        throw new AuthenticationException(
          'Authorization token missing from request',
          ERROR_CODES.AUTH_TOKEN_MISSING,
          '缺少 token，请登录',
        );
      }
      let user = null;
      let verifyError: any = null;
      try {
        user = await this.cognitoService.verifyAccessToken(token);
      } catch (err: any) {
        verifyError = err;
        console.log(
          '[AuthMiddleware] verifyAccessToken抛出异常:',
          err?.message || err,
        );
      }

      const isExpired =
        verifyError?.errorCode === ERROR_CODES.AUTH_TOKEN_EXPIRED ||
        (typeof verifyError?.message === 'string' &&
          verifyError.message.toLowerCase().includes('expired'));

      if (!user && isExpired) {
        const refreshToken = this.getCookieValue(req, 'refreshToken');
        if (!refreshToken) {
          console.log('[AuthMiddleware] access token 过期且缺少 refresh token');
          throw new AuthenticationException(
            'Refresh token missing while access token expired',
            ERROR_CODES.AUTH_TOKEN_EXPIRED,
            '登录已过期，请重新登录',
          );
        }

        console.log('[AuthMiddleware] access token 过期，尝试 refresh');
        const tokens = await this.cognitoService.refreshTokens(refreshToken);
        this.setAuthCookies(res, tokens);
        user = await this.cognitoService.verifyAccessToken(tokens.accessToken);
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
