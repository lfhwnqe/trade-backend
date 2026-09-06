import { ForbiddenException } from '@nestjs/common';
import { BridgeAccessService, BridgeGuard } from './bridge-access.service';
import { AuthMiddleware } from '../common/auth.middleware';
import { ApiTokenService } from '../common/api-token.service';

const owner = '00000000-0000-4000-8000-000000000001';

describe('Bridge access', () => {
  let access: BridgeAccessService;
  let send: jest.Mock;
  beforeEach(() => {
    access = new BridgeAccessService({
      getOrThrow: (key: string) =>
        key === 'AWS_REGION' ? 'ap-northeast-1' : 'pool',
    } as any);
    send = jest
      .fn()
      .mockResolvedValueOnce({ Users: [{ Username: 'trusted-username' }] })
      .mockResolvedValueOnce({ Enabled: true });
    (access as any).client = { send };
  });
  it.each(['Admins', 'SuperAdmins'])(
    'allows the live %s role',
    async (group) => {
      send.mockResolvedValueOnce({ Groups: [{ GroupName: group }] });
      await expect(access.assertOwner(owner)).resolves.toBeUndefined();
      expect(send.mock.calls[0][0].input).toEqual({
        UserPoolId: 'pool',
        Filter: `sub = "${owner}"`,
        Limit: 2,
      });
      expect(send.mock.calls[2][0].input.Username).toBe('trusted-username');
    },
  );
  it.each(['FreePlan', 'ProPlan'])(
    'rejects %s including a downgraded administrator',
    async (group) => {
      send.mockResolvedValueOnce({ Groups: [{ GroupName: group }] });
      await expect(access.assertOwner(owner)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    },
  );
  it('denies disabled accounts', async () => {
    send
      .mockReset()
      .mockResolvedValueOnce({ Users: [{ Username: 'u' }] })
      .mockResolvedValueOnce({ Enabled: false });
    await expect(access.assertOwner(owner)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(send).toHaveBeenCalledTimes(2);
  });
  it('follows group pagination', async () => {
    send
      .mockResolvedValueOnce({
        Groups: [{ GroupName: 'Other' }],
        NextToken: 'next',
      })
      .mockResolvedValueOnce({ Groups: [{ GroupName: 'SuperAdmins' }] });
    await expect(access.assertOwner(owner)).resolves.toBeUndefined();
    expect(send.mock.calls[3][0].input.NextToken).toBe('next');
  });
  it('fails closed when the trusted role service is unavailable', async () => {
    send.mockRejectedValueOnce(new Error('offline'));
    await expect(access.assertOwner(owner)).rejects.toThrow('offline');
  });
});

describe('Bridge scope and token routing', () => {
  const context = (request: any) =>
    ({ switchToHttp: () => ({ getRequest: () => request }) }) as any;
  it.each([
    ['GET', 'trade:read'],
    ['POST', 'trade:write'],
  ])('maps %s to the existing %s scope', async (method, scope) => {
    const access = { assertOwner: jest.fn().mockResolvedValue(undefined) };
    const guard = new BridgeGuard(access as any);
    await expect(
      guard.canActivate(
        context({
          method,
          user: { sub: owner },
          authType: 'apiToken',
          scopes: [scope],
        }),
      ),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(
        context({
          method,
          user: { sub: owner, role: 'Admins' },
          authType: 'apiToken',
          scopes: [],
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(access.assertOwner).toHaveBeenCalledTimes(1);
  });
  it('never treats client role claims as permission', async () => {
    const guard = new BridgeGuard({
      assertOwner: jest.fn().mockRejectedValue(new ForbiddenException()),
    } as any);
    await expect(
      guard.canActivate(
        context({
          method: 'GET',
          user: { sub: owner, role: 'Admins' },
          authType: 'apiToken',
          scopes: ['trade:read'],
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      guard.canActivate(context({ method: 'GET' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it.each(['authorization', 'x-api-token'])(
    'accepts an existing token through %s for bridge routes',
    async (header) => {
      const tokens = {
        authenticateToken: jest.fn().mockResolvedValue({
          userId: owner,
          tokenId: 'token',
          scopes: ['trade:read', 'trade:write'],
        }),
      };
      const middleware = new AuthMiddleware({} as any, tokens as any);
      const req = {
        headers: {
          [header]:
            header === 'authorization' ? 'Bearer tc_secret' : 'tc_secret',
        },
        path: '/bridge/tasks',
        originalUrl: '/bridge/tasks',
        method: 'GET',
      } as any;
      const next = jest.fn();
      await middleware.use(req, {} as any, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toEqual({ sub: owner });
    },
  );
  it('does not open unrelated routes for tokens', async () => {
    const middleware = new AuthMiddleware(
      {} as any,
      {
        authenticateToken: jest
          .fn()
          .mockResolvedValue({ userId: owner, scopes: ['trade:read'] }),
      } as any,
    );
    const req = {
      headers: { authorization: 'Bearer tc_secret' },
      path: '/bridge-other',
      originalUrl: '/bridge-other',
      method: 'GET',
    } as any;
    const next = jest.fn();
    await expect(middleware.use(req, {} as any, next)).rejects.toThrow();
    expect(next).not.toHaveBeenCalled();
  });
  it('rejects invalid tokens before reaching bridge', async () => {
    const middleware = new AuthMiddleware(
      {} as any,
      { authenticateToken: jest.fn().mockResolvedValue(null) } as any,
    );
    const next = jest.fn();
    await expect(
      middleware.use(
        {
          headers: { authorization: 'Bearer tc_bad' },
          path: '/bridge/tasks',
        } as any,
        {} as any,
        next,
      ),
    ).rejects.toThrow();
    expect(next).not.toHaveBeenCalled();
  });
  it('checks revocation with a strongly consistent token read', async () => {
    const tokens = new ApiTokenService({
      getOrThrow: (key: string) =>
        key === 'AWS_REGION' ? 'ap-northeast-1' : 'tokens',
    } as any);
    const db = {
      get: jest
        .fn()
        .mockResolvedValue({ Item: { userId: owner, revokedAt: 'now' } }),
      update: jest.fn(),
    };
    (tokens as any).db = db;
    await expect(tokens.authenticateToken('tc_revoked')).resolves.toBeNull();
    expect(db.get).toHaveBeenCalledWith(
      expect.objectContaining({ ConsistentRead: true }),
    );
    expect(db.update).not.toHaveBeenCalled();
  });
});

describe('Bridge consumer route boundaries', () => {
  it.each([
    ['GET', '/bridge/tasks', true],
    ['POST', '/bridge/tasks/' + 'a'.repeat(64) + '/read', true],
    ['GET', '/prod/bridge/tasks', true],
    ['GET', '/bridge/hooks', false],
    ['POST', '/bridge/hooks', false],
    ['DELETE', '/bridge/hooks/id', false],
  ])('%s %s allowed=%s', async (method, path, allowed) => {
    const previous = process.env.APP_ENV;
    process.env.APP_ENV = 'prod';
    try {
      const middleware = new AuthMiddleware(
        {} as any,
        {
          authenticateToken: jest.fn().mockResolvedValue({
            userId: owner,
            scopes: ['trade:read', 'trade:write'],
          }),
        } as any,
      );
      const next = jest.fn();
      const promise = middleware.use(
        {
          headers: { authorization: 'Bearer tc_test' },
          path,
          originalUrl: path + '?limit=20',
          method,
        } as any,
        {} as any,
        next,
      );
      if (allowed) {
        await promise;
        expect(next).toHaveBeenCalledTimes(1);
      } else {
        await expect(promise).rejects.toThrow();
        expect(next).not.toHaveBeenCalled();
      }
    } finally {
      if (previous === undefined) delete process.env.APP_ENV;
      else process.env.APP_ENV = previous;
    }
  });
});
