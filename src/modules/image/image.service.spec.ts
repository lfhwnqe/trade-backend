import { ImageService } from './image.service';
import { ConfigService } from '../common/config.service';
import { ERROR_CODES } from '../../base/constants/error-codes';

describe('ImageService.consumeUploadQuota', () => {
  const makeConfig = (extra?: Record<string, string>) => {
    const base: Record<string, string> = {
      AWS_REGION: 'ap-southeast-1',
      CONFIG_TABLE_NAME: 'cfg',
      IMAGE_BUCKET_NAME: 'bucket',
      CLOUDFRONT_DOMAIN_NAME: 'cdn.example.com',
      IMAGE_UPLOAD_DAILY_COUNT_FREE: '2',
      IMAGE_UPLOAD_DAILY_BYTES_FREE: '1000',
      IMAGE_UPLOAD_RATE_LIMIT_PER_MINUTE_FREE: '2',
      IMAGE_UPLOAD_DAILY_COUNT_API_TOKEN: '1',
      IMAGE_UPLOAD_DAILY_BYTES_API_TOKEN: '100',
      IMAGE_UPLOAD_RATE_LIMIT_PER_MINUTE_API_TOKEN: '1',
    };
    const map = { ...base, ...(extra || {}) };
    const cfg = {
      get: jest.fn((k: string) => map[k]),
      getOrThrow: jest.fn((k: string) => {
        const v = map[k];
        if (v === undefined) throw new Error(`missing ${k}`);
        return v;
      }),
    } as unknown as ConfigService;
    return cfg;
  };

  const makeService = (cfg = makeConfig()) => {
    const svc = new ImageService(cfg);
    const update = jest.fn();
    (svc as any).db = { update };
    (svc as any).configTableName = 'cfg';
    return { svc, update };
  };

  it('should call db.update twice on success', async () => {
    const { svc, update } = makeService();
    update.mockResolvedValue({});

    await svc.consumeUploadQuota({
      userId: 'u1',
      claims: {},
      authType: 'cognito',
      contentLength: 123,
    });

    expect(update).toHaveBeenCalledTimes(2);
    const firstCall = update.mock.calls[0][0];
    const secondCall = update.mock.calls[1][0];
    expect(firstCall.Key.configKey).toContain('imageRate#');
    expect(secondCall.Key.configKey).toContain('imageQuota#');
    expect(secondCall.ExpressionAttributeValues[':byteInc']).toBe(123);
  });

  it('should throw IMAGE_RATE_LIMITED when minute limiter conditional fails', async () => {
    const { svc, update } = makeService();
    update.mockRejectedValueOnce({
      name: 'ConditionalCheckFailedException',
      message: 'maxMinuteBefore',
    });

    await expect(
      svc.consumeUploadQuota({
        userId: 'u1',
        claims: {},
        authType: 'cognito',
        contentLength: 10,
      }),
    ).rejects.toMatchObject({
      errorCode: ERROR_CODES.IMAGE_RATE_LIMITED,
    });
  });

  it('should throw IMAGE_QUOTA_EXCEEDED when quota conditional fails', async () => {
    const { svc, update } = makeService();
    update.mockResolvedValueOnce({});
    update.mockRejectedValueOnce({
      name: 'ConditionalCheckFailedException',
      message: 'quota reached',
    });

    await expect(
      svc.consumeUploadQuota({
        userId: 'u1',
        claims: {},
        authType: 'cognito',
        contentLength: 999,
      }),
    ).rejects.toMatchObject({
      errorCode: ERROR_CODES.IMAGE_QUOTA_EXCEEDED,
    });
  });

  it('should use api token actor and token limits', async () => {
    const { svc, update } = makeService();
    update.mockResolvedValue({});

    await svc.consumeUploadQuota({
      userId: 'u1',
      claims: {},
      authType: 'apiToken',
      apiTokenId: 'tk-1',
      contentLength: 50,
    });

    const firstCall = update.mock.calls[0][0];
    const secondCall = update.mock.calls[1][0];
    expect(firstCall.Key.configKey).toContain('token:tk-1');
    expect(secondCall.Key.configKey).toContain('token:tk-1');
    expect(secondCall.ExpressionAttributeValues[':maxCountBefore']).toBe(0); // api token daily count=1
  });
});
