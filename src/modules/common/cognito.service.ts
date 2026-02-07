import { Injectable, Logger } from '@nestjs/common';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { ConfigService } from './config.service';
import { CognitoException } from '../../base/exceptions/custom.exceptions';
import { ERROR_CODES } from '../../base/constants/error-codes';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  ChangePasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';

@Injectable()
export class CognitoService {
  private readonly logger = new Logger(CognitoService.name);
  private verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;
  private cognitoClient: CognitoIdentityProviderClient | null = null;
  private clientId: string | null = null;
  private region: string | null = null;

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

        this.region = region;
        this.clientId = clientId;

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
   * 获取或延迟初始化 CognitoIdentityProviderClient
   */
  private getCognitoClient() {
    if (!this.cognitoClient) {
      const region = this.region || this.configService.getOrThrow('AWS_REGION');
      this.region = region;
      this.cognitoClient = new CognitoIdentityProviderClient({ region });
    }
    if (!this.clientId) {
      this.clientId = this.configService.getOrThrow('USER_POOL_CLIENT_ID');
    }
    return { client: this.cognitoClient, clientId: this.clientId };
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

  /**
   * 使用 refresh token 续签 access / id token。
   * 注意：Cognito 通常不会返回新的 refresh token，因此默认沿用旧的。
   */
  async refreshTokens(refreshToken: string): Promise<{
    accessToken: string;
    idToken: string;
    refreshToken: string;
  }> {
    if (!refreshToken) {
      throw new CognitoException(
        'Refresh token is required',
        ERROR_CODES.AUTH_TOKEN_MISSING,
        '缺少 refresh token，请重新登录',
      );
    }

    try {
      const { client, clientId } = this.getCognitoClient();
      const response = await client.send(
        new InitiateAuthCommand({
          AuthFlow: 'REFRESH_TOKEN_AUTH',
          ClientId: clientId,
          AuthParameters: {
            REFRESH_TOKEN: refreshToken,
          },
        }),
      );

      const result = response.AuthenticationResult;
      if (!result?.AccessToken || !result?.IdToken) {
        this.logger.error(
          'Refresh token succeeded but AuthenticationResult was incomplete.',
        );
        throw new CognitoException(
          'Refresh token response missing tokens',
          ERROR_CODES.AUTH_VERIFICATION_FAILED,
          '续签失败，请重新登录',
        );
      }

      return {
        accessToken: result.AccessToken,
        idToken: result.IdToken,
        refreshToken: result.RefreshToken || refreshToken,
      };
    } catch (error: any) {
      this.logger.warn(
        `Refresh token failed: ${error?.name || 'UnknownError'} ${error?.message || ''}`,
      );

      throw new CognitoException(
        `Refresh token failed: ${error?.message || 'Unknown error'}`,
        ERROR_CODES.AUTH_TOKEN_INVALID,
        '登录状态已过期，请重新登录',
        { error: error?.name, message: error?.message },
      );
    }
  }

  /**
   * 修改密码（登录态）
   * - 使用 Cognito ChangePassword API
   * - 需要 accessToken
   */
  async changePassword(
    accessToken: string,
    oldPassword: string,
    newPassword: string,
  ) {
    if (!accessToken) {
      throw new CognitoException(
        'Access token is required',
        ERROR_CODES.AUTH_TOKEN_MISSING,
        '请先登录后再修改密码',
      );
    }

    try {
      const { client } = this.getCognitoClient();
      await client.send(
        new ChangePasswordCommand({
          AccessToken: accessToken,
          PreviousPassword: oldPassword,
          ProposedPassword: newPassword,
        }),
      );

      return { success: true };
    } catch (error: any) {
      // Common Cognito errors:
      // - NotAuthorizedException: old password wrong / invalid session
      // - InvalidPasswordException: new password policy violation
      const name = error?.name || 'UnknownError';
      const message = error?.message || '';
      this.logger.warn(`[cognito][changePassword] failed: ${name} ${message}`);

      if (name === 'InvalidPasswordException') {
        throw new CognitoException(
          `Invalid new password: ${message}`,
          ERROR_CODES.COGNITO_INVALID_PASSWORD,
          '新密码不符合密码策略，请调整后重试',
          { name, message },
        );
      }

      if (name === 'NotAuthorizedException') {
        throw new CognitoException(
          `Change password unauthorized: ${message}`,
          ERROR_CODES.AUTH_UNAUTHORIZED,
          '旧密码不正确，或登录状态已失效',
          { name, message },
        );
      }

      throw new CognitoException(
        `Change password failed: ${message}`,
        ERROR_CODES.COGNITO_CONFIG_ERROR,
        '修改密码失败，请稍后再试',
        { name, message },
      );
    }
  }
}
