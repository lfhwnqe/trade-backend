import { CognitoJwtVerifier } from 'aws-jwt-verify';

let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

/**
 * 获取或延迟初始化 Cognito verifier，缺参数时直接抛出异常说明问题
 */
function getVerifier() {
  if (!verifier) {
    const region = process.env.AWS_REGION;
    const userPoolId = process.env.USER_POOL_ID;
    const clientId = process.env.USER_POOL_CLIENT_ID;
    if (!region || !userPoolId || !clientId) {
      throw new Error(
        `Cognito 校验参数不全，缺少 AWS_REGION/USER_POOL_ID/USER_POOL_CLIENT_ID，请检查环境变量配置。当前: region=${region}, userPoolId=${userPoolId}, clientId=${clientId}`
      );
    }
    verifier = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: 'access', // 专门校验 accessToken
      clientId,
      region,
    });
  }
  return verifier;
}

/**
 * 验证并解析 accessToken。校验失败抛异常，成功返回用户 claim（含sub, username, email等attribute）。
 * @param token 
 * @returns 
 */
export const verifyAccessToken = async (token: string) => {
  try {
    // 返回 decoded payload
    return await getVerifier().verify(token);
  } catch (e: any) {
    throw new Error(
      'Token 校验失败: ' + (e?.message || 'Cognito accessToken verify failed')
    );
  }
};