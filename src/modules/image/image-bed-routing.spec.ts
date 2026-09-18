import { AuthMiddleware } from '../common/auth.middleware';

describe('Image-bed token route boundary', () => {
  it.each([
    ['POST', '/image/upload-url', true],
    ['POST', '/prod/image/upload-url', true],
    ['POST', '/image/upload-url/extra', false],
    ['POST', '/image/upload-url-other', false],
    ['POST', '/image/delete', false],
    ['GET', '/image/upload-url', false],
    ['GET', '/image/url/key', false],
    ['DELETE', '/image/key', false],
    ['POST', '/user/tokens', false],
  ])('%s %s allowed=%s', async (method, path, allowed) => {
    const previous = process.env.APP_ENV;
    process.env.APP_ENV = 'prod';
    try {
      const middleware = new AuthMiddleware({} as any, {
        authenticateToken: jest.fn().mockResolvedValue({ userId: 'owner', scopes: ['trade:write'] }),
      } as any);
      const next = jest.fn();
      const result = middleware.use({ method, path, originalUrl: path + '?test=1', headers: { authorization: 'Bearer tc_test_fixture' } } as any, {} as any, next);
      if (allowed) { await result; expect(next).toHaveBeenCalledTimes(1); }
      else { await expect(result).rejects.toThrow(); expect(next).not.toHaveBeenCalled(); }
    } finally {
      if (previous === undefined) delete process.env.APP_ENV;
      else process.env.APP_ENV = previous;
    }
  });
});
