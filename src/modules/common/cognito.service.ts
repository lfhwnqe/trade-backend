import { Injectable } from '@nestjs/common';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { ConfigService } from './config.service';
import { CognitoException } from '../../base/exceptions/custom.exceptions';
import { ERROR_CODES } from '../../base/constants/error-codes';

@Injectable()
export class CognitoService {
  private verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

  constructor(private readonly configService: ConfigService) {}

  /**
   * 获取或延迟初始化 Cognito verifier，缺参数时直接抛出异常说明问题
   */
  private getVerifier() {
    if (!this.verifier) {
      try {
        const region = this.configService.getOrThrow('AWS_REGION');
        const userPoolId = this.configService.getOrThrow('USER_POOL_ID');
        const clientId = this.configService.getOrThrow('USER_POOL_CLIENT_ID');

        this.verifier = CognitoJwtVerifier.create({
          userPoolId,
          tokenUse: 'access', // 专门校验 accessToken
          clientId,
          region,
        });
      } catch (error) {
        throw new CognitoException(
          `Cognito configuration missing: ${error.message}`,
          ERROR_CODES.COGNITO_CONFIG_MISSING,
          '认证服务配置异常，请联系管理员',
          { error: error.message },
        );
      }
    }
    return this.verifier;
  }

  /**
   * 验证并解析 accessToken。校验失败抛异常，成功返回用户 claim（含sub, username, email等attribute）。
   * @param token
   * @returns
   */
  async verifyAccessToken(token: string) {
    if (!token) {
      throw new CognitoException(
        'Access token is required',
        ERROR_CODES.AUTH_TOKEN_MISSING,
        '请提供访问令牌',
      );
    }

    try {
      return await this.getVerifier().verify(token);
    } catch (e: any) {
      // 根据不同的错误类型抛出不同的异常
      if (e?.message?.includes('expired')) {
        throw new CognitoException(
          `Token expired: ${e.message}`,
          ERROR_CODES.AUTH_TOKEN_EXPIRED,
          '访问令牌已过期，请重新登录',
          { originalError: e.message },
        );
      } else if (e?.message?.includes('invalid')) {
        throw new CognitoException(
          `Invalid token: ${e.message}`,
          ERROR_CODES.AUTH_TOKEN_INVALID,
          '访问令牌无效，请重新登录',
          { originalError: e.message },
        );
      } else {
        throw new CognitoException(
          `Token verification failed: ${e?.message || 'Unknown error'}`,
          ERROR_CODES.COGNITO_VERIFICATION_FAILED,
          '令牌验证失败，请重新登录',
          { originalError: e?.message },
        );
      }
    }
  }
}
