import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from './cognito.util';

// 白名单路径
const whitelist = [
  '/user/register',
  '/user/confirm',
  '/user/login',
  '/user/registration/status',
];

// 这里函数式实现，无 class
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // 判断是否需要鉴权（白名单）
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

    // 校验 token 并获取用户 claims
    const user = await verifyAccessToken(token);
    if (!user) {
      return res.status(401).json({ message: 'token 校验失败' });
    }
    // 挂载用户信息
    (req as any).user = user;
    return next();
  } catch (e: any) {
    // 返回鉴权失败
    return res.status(401).json({ message: 'token 校验失败: ' + (e?.message || '') });
  }
};
