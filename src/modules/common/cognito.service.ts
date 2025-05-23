import { Injectable } from '@nestjs/common';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { ConfigService } from './config.service';

@Injectable()
export class CognitoService {
  private verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

  constructor(private readonly configService: ConfigService) {}

  /**
   * 获取或延迟初始化 Cognito verifier，缺参数时直接抛出异常说明问题
   */
  private getVerifier() {
    if (!this.verifier) {
      const region = this.configService.getOrThrow('AWS_REGION');
      const userPoolId = this.configService.getOrThrow('USER_POOL_ID');
      const clientId = this.configService.getOrThrow('USER_POOL_CLIENT_ID');
      // 可保留日志

      this.verifier = CognitoJwtVerifier.create({
        userPoolId,
        tokenUse: 'access', // 专门校验 accessToken
        clientId,
        region,
      });
    }
    return this.verifier;
  }

  /**
   * 验证并解析 accessToken。校验失败抛异常，成功返回用户 claim（含sub, username, email等attribute）。
   * @param token
   * @returns
   */
  async verifyAccessToken(token: string) {
    try {
      return await this.getVerifier().verify(token);
    } catch (e: any) {
      throw new Error(
        'Token 校验失败: ' +
          (e?.message || 'Cognito accessToken verify failed'),
      );
    }
  }
}
