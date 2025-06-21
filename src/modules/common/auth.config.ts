/**
 * 认证配置文件
 * 统一管理认证相关的配置，包括白名单路径
 */

/**
 * 认证白名单路径
 * 这些路径不需要进行身份验证
 */
export const AUTH_WHITELIST = [
  '/user/login',
  '/user/register',
  '/user/confirm',
  '/user/registration/status',
  '/examples/standard-response',
];

/**
 * 检查路径是否在白名单中
 * @param path 请求路径
 * @returns 是否在白名单中
 */
export function isPathWhitelisted(path: string): boolean {
  return AUTH_WHITELIST.some((pattern) => path.startsWith(pattern));
}