import { MiddlewareConsumer, Module, NestModule, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ImageController } from './image.controller';
import { ImageService } from './image.service';
import { AuthMiddleware } from '../common/auth.middleware';
import { CognitoService } from '../common/cognito.service';
import { ApiTokenService } from '../common/api-token.service';
import { AdministratorAccessService } from '../common/administrator-access.service';

const owner = '00000000-0000-4000-8000-000000000001';
const key = `uploads/${owner}/unbound/2026-09-17/123-0001-01.png`;
const image = {
  generateUploadUrl: jest.fn().mockResolvedValue({ success: true, data: { key, uploadUrl: 'https://s3.example/upload?signature=test' } }),
  getImageUrl: jest.fn().mockResolvedValue({ success: true, data: { url: `https://cdn.example/${key}` } }),
  consumeUploadQuota: jest.fn().mockResolvedValue(undefined),
};
const config = { getOrThrow: (k: string) => k === 'AWS_REGION' ? 'ap-southeast-1' : 'test' } as any;
const access = new AdministratorAccessService(config);
const tokenService = new ApiTokenService(config);
const db = { get: jest.fn(), update: jest.fn().mockResolvedValue({}) };
(tokenService as any).db = db;
const send = jest.fn();
(access as any).client = { send };
const cognito = { verifyAccessToken: jest.fn() };

@Module({
  controllers: [ImageController],
  providers: [
    AuthMiddleware,
    { provide: ImageService, useValue: image },
    { provide: AdministratorAccessService, useValue: access },
    { provide: ApiTokenService, useValue: tokenService },
    { provide: CognitoService, useValue: cognito },
  ],
})
class ImageTestModule implements NestModule {
  configure(consumer: MiddlewareConsumer) { consumer.apply(AuthMiddleware).forRoutes(ImageController); }
}

const body = { fileName: '0001-01.png', fileType: 'image/png', date: '2026-09-17', contentLength: 100 };
describe('Administrator image-bed HTTP permissions (mock AWS only)', () => {
  let app: any;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [ImageTestModule] }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    await app.listen(0, '127.0.0.1');
  });
  afterAll(async () => { await app.close(); });
  beforeEach(() => {
    jest.clearAllMocks();
    send.mockReset()
      .mockResolvedValueOnce({ Users: [{ Username: 'server-resolved-user' }] })
      .mockResolvedValueOnce({ Enabled: true })
      .mockResolvedValueOnce({ Groups: [{ GroupName: 'SuperAdmins' }] });
    db.get.mockResolvedValue({ Item: { userId: owner, tokenId: 'test-token', scopes: ['trade:read', 'trade:write'] } });
    cognito.verifyAccessToken.mockResolvedValue({ sub: owner, 'cognito:groups': ['Admins'] });
  });
  const upload = (payload: object = body) => request(app.getHttpServer()).post('/image/upload-url').set('Authorization', 'Bearer tc_test_fixture').send(payload);

  it.each(['Authorization', 'X-API-Token'])('permits an existing administrator token via %s and returns an unsigned public URL', async (header) => {
    const res = await request(app.getHttpServer()).post('/image/upload-url')
      .set(header, header === 'Authorization' ? 'Bearer tc_test_fixture' : 'tc_test_fixture').send(body).expect(201);
    expect(res.body.data.publicUrl).toBe(`https://cdn.example/${key}`);
    expect(new URL(res.body.data.publicUrl).search).toBe('');
    expect(res.body.data.expiresInSec).toBe(300);
    expect(image.generateUploadUrl).toHaveBeenCalledWith(owner, body.fileName, body.fileType, body.date, 100);
    expect(image.consumeUploadQuota).toHaveBeenCalledWith({ userId: owner, authType: 'apiToken', apiTokenId: 'test-token', contentLength: 100 });
    expect(send.mock.calls[2][0].input.Username).toBe('server-resolved-user');
  });
  it('rejects read-only scope before role lookup or signing', async () => {
    db.get.mockResolvedValue({ Item: { userId: owner, scopes: ['trade:read'] } });
    await upload().expect(403);
    expect(send).not.toHaveBeenCalled();
    expect(image.generateUploadUrl).not.toHaveBeenCalled();
  });
  it.each(['FreePlan', 'ProPlan'])('rejects a current %s user despite a valid token', async (group) => {
    send.mockReset().mockResolvedValueOnce({ Users: [{ Username: 'ordinary' }] })
      .mockResolvedValueOnce({ Enabled: true }).mockResolvedValueOnce({ Groups: [{ GroupName: group }] });
    await upload().expect(403);
    expect(image.generateUploadUrl).not.toHaveBeenCalled();
    expect(image.consumeUploadQuota).not.toHaveBeenCalled();
  });
  it('rejects disabled accounts', async () => {
    send.mockReset().mockResolvedValueOnce({ Users: [{ Username: 'disabled' }] }).mockResolvedValueOnce({ Enabled: false });
    await upload().expect(403);
    expect(image.generateUploadUrl).not.toHaveBeenCalled();
  });
  it.each([undefined, { userId: owner, revokedAt: '2026-09-17' }])('rejects missing/revoked token records', async (Item) => {
    db.get.mockResolvedValue({ Item });
    await upload().expect(401);
    expect(send).not.toHaveBeenCalled();
    expect(image.generateUploadUrl).not.toHaveBeenCalled();
  });
  it('preserves administrator cookie upload without requiring contentLength', async () => {
    const { contentLength, ...legacyBody } = body;
    const res = await request(app.getHttpServer()).post('/image/upload-url').set('Cookie', 'token=test-session').send(legacyBody).expect(201);
    expect(res.body.data.key).toBe(key);
    expect(send).not.toHaveBeenCalled();
    expect(image.consumeUploadQuota).not.toHaveBeenCalled();
  });
  it('keeps ordinary cookie users forbidden', async () => {
    cognito.verifyAccessToken.mockResolvedValue({ sub: owner, 'cognito:groups': ['FreePlan'] });
    await request(app.getHttpServer()).post('/image/upload-url').set('Cookie', 'token=test-session').send(body).expect(403);
    expect(image.generateUploadUrl).not.toHaveBeenCalled();
  });
  it.each([undefined, null, 0, -1, 1.5, '100'])('rejects invalid/missing token contentLength %s', async (contentLength) => {
    await upload({ ...body, contentLength }).expect(400);
    expect(image.generateUploadUrl).not.toHaveBeenCalled();
  });
  it.each([{ fileType: 'text/plain' }, { date: 'today' }, { fileName: '../escape.png' }, { userId: 'someone-else' }])('rejects malformed metadata %p', async (invalid) => {
    await upload({ ...body, ...invalid }).expect(400);
    expect(image.generateUploadUrl).not.toHaveBeenCalled();
  });
  it('does not allow token access to legacy read-url or delete routes', async () => {
    await request(app.getHttpServer()).get('/image/url/example.png').set('Authorization', 'Bearer tc_test_fixture').expect(401);
    await request(app.getHttpServer()).delete('/image/example.png').set('Authorization', 'Bearer tc_test_fixture').expect(401);
    expect(image.getImageUrl).not.toHaveBeenCalled();
  });
});
