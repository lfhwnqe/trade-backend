import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BridgeHooksService } from './bridge-hooks.service';

describe('Independent Bridge hooks', () => {
  let service: BridgeHooksService;
  let db: any;
  beforeEach(() => {
    service = new BridgeHooksService({
      getOrThrow: () => 'ap-southeast-1',
      get: () => 'bridge-hooks-test',
    } as any);
    db = {
      put: jest.fn().mockResolvedValue({}),
      get: jest.fn(),
      update: jest.fn(),
      query: jest.fn(),
    };
    (service as any).db = db;
  });
  it('issues a URL once and stores only a credential digest without trade linkage', async () => {
    const created = await service.create('owner', { name: 'BTC alerts' });
    const stored = db.put.mock.calls[0][0].Item;
    expect(stored).not.toHaveProperty('tradeShortId');
    expect(stored).not.toHaveProperty('triggerToken');
    expect(created).not.toHaveProperty('secretHash');
    const token = created.webhookPath.split('/').pop();
    expect(JSON.stringify(stored)).not.toContain(token);
    db.get.mockResolvedValue({ Item: stored });
    await expect(service.authenticate(token)).resolves.toEqual({
      userId: 'owner',
      hookId: created.hookId,
    });
    expect(db.get).toHaveBeenCalledWith(
      expect.objectContaining({ ConsistentRead: true }),
    );
  });
  it('rejects legacy trade tokens', async () => {
    await expect(service.authenticate('tw_legacy')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(db.get).not.toHaveBeenCalled();
  });
  it('rotation invalidates the old URL and revocation invalidates the new URL', async () => {
    const first = await service.create('owner', { name: 'alerts' });
    let stored = db.put.mock.calls[0][0].Item;
    db.update.mockImplementation(async (input: any) => {
      stored = {
        ...stored,
        secretHash: input.ExpressionAttributeValues[':hash'],
      };
      return { Attributes: stored };
    });
    const rotated = await service.rotate('owner', first.hookId);
    db.get.mockImplementation(async () => ({ Item: stored }));
    await expect(
      service.authenticate(first.webhookPath.split('/').pop()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.authenticate(rotated.webhookPath.split('/').pop()),
    ).resolves.toMatchObject({ userId: 'owner' });
    stored.revokedAt = 'now';
    await expect(
      service.authenticate(rotated.webhookPath.split('/').pop()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('lists only the owner hooks without returning credentials', async () => {
    const created = await service.create('owner', { name: 'alerts' });
    db.query.mockResolvedValue({ Items: [{ hookId: created.hookId }] });
    db.get.mockResolvedValue({ Item: db.put.mock.calls[0][0].Item });
    const result = await service.list('owner');
    expect(result.items[0]).not.toHaveProperty('secretHash');
    expect(result.items[0]).not.toHaveProperty('webhookPath');
    expect(db.query.mock.calls[0][0].ExpressionAttributeValues).toEqual({
      ':u': 'owner',
    });
  });
  it('uses owner conditions for revoke/rotate and denies another account', async () => {
    const created = await service.create('owner', { name: 'alerts' });
    db.update.mockRejectedValue({ name: 'ConditionalCheckFailedException' });
    await expect(
      service.revoke('other', created.hookId),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.rotate('other', created.hookId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(db.update.mock.calls[0][0].ConditionExpression).toBe('userId = :u');
    expect(db.update.mock.calls[1][0].ExpressionAttributeValues[':u']).toBe(
      'other',
    );
  });
});
