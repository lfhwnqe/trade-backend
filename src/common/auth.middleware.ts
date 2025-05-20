import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CognitoService } from './cognito.service';

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
        return next();
      }
      const cookie = req.headers.cookie || '';
      const token = cookie
        .split(';')
        .map((item) => item.trim())
        .find((item) => item.startsWith('token='))
        ?.split('=')[1];

      if (!token) {
        return res.status(401).json({ message: '缺少 token，请登录' });
      }
      const user = await this.cognitoService.verifyAccessToken(token);
      console.log('user:', user);
      if (!user) {
        return res.status(401).json({ message: 'token 校验失败' });
      }
      (req as any).user = user;
      return next();
    } catch (e: any) {
      return res
        .status(401)
        .json({ message: 'token 校验失败: ' + (e?.message || '') });
    }
  }
}
