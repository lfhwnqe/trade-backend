import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BridgeService } from './bridge.service';
import { canonical, notification } from './bridge.validation';

const owner = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const id = 'a'.repeat(64);
const conditionFailure = { name: 'ConditionalCheckFailedException' };

describe('Bridge notifications', () => {
  let service: BridgeService;
  let db: any;
  let hooks: any;
  let access: any;
  beforeEach(() => {
    db = {
      put: jest.fn().mockResolvedValue({}),
      get: jest.fn(),
      query: jest.fn(),
      update: jest.fn(),
    };
    hooks = {
      authenticate: jest
        .fn()
        .mockResolvedValue({ userId: owner, hookId: 'hook-1' }),
    };
    access = { assertOwner: jest.fn().mockResolvedValue(undefined) };
    service = new BridgeService(
      { getOrThrow: () => 'ap-northeast-1', get: () => 'bridge-test' } as any,
      hooks,
      access,
    );
    (service as any).db = db;
  });
  it('persists arbitrary notification data under the authenticated source owner', async () => {
    const result = await service.receive('source-secret', {
      message: 'BTC alert',
      userId: other,
    });
    expect(result).toMatchObject({ status: 'unread', duplicate: false });
    expect(access.assertOwner).toHaveBeenCalledWith(owner);
    expect(db.put).toHaveBeenCalledWith(
      expect.objectContaining({
        Item: expect.objectContaining({
          userId: owner,
          hookId: 'hook-1',
          status: 'unread',
          payload: { message: 'BTC alert', userId: other },
        }),
        ConditionExpression: 'attribute_not_exists(taskId)',
      }),
    );
    expect(JSON.stringify(db.put.mock.calls)).not.toContain('source-secret');
  });
  it('accepts plain text and creates distinct tasks without event_id', async () => {
    const a = await service.receive('source-secret', 'a plain alert');
    const b = await service.receive('source-secret', 'a plain alert');
    expect(a.taskId).not.toBe(b.taskId);
    expect(db.put.mock.calls[0][0].Item.payload).toEqual({
      message: 'a plain alert',
    });
  });
  it('retries the same event id without reopening a read notification', async () => {
    const payload = { event_id: 'stable-event', message: 'test' };
    const first = await service.receive('source-secret', payload);
    const saved = db.put.mock.calls[0][0].Item;
    db.put.mockRejectedValueOnce(conditionFailure);
    db.get.mockResolvedValueOnce({
      Item: { ...saved, status: 'read', readAt: '2026-09-06T00:00:00Z' },
    });
    expect(
      await service.receive('source-secret', {
        message: 'test',
        event_id: 'stable-event',
      }),
    ).toEqual({
      taskId: first.taskId,
      status: 'read',
      duplicate: true,
    });
  });
  it('rejects conflicting payloads for the same event_id', async () => {
    await service.receive('source-secret', {
      event_id: 'same',
      message: 'first',
    });
    const saved = db.put.mock.calls[0][0].Item;
    db.put.mockRejectedValueOnce(conditionFailure);
    db.get.mockResolvedValueOnce({ Item: saved });
    await expect(
      service.receive('source-secret', {
        event_id: 'same',
        message: 'changed',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it.each(['invalid', 'revoked', 'rotated', 'downgraded'])(
    'rejects %s sources without saving',
    async (kind) => {
      if (kind !== 'downgraded')
        hooks.authenticate.mockRejectedValue(new ForbiddenException());
      if (kind === 'downgraded')
        access.assertOwner.mockRejectedValue(new ForbiddenException());
      await expect(
        service.receive('source-secret', { message: 'test' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(db.put).not.toHaveBeenCalled();
    },
  );
  it('does not report success if storage fails', async () => {
    db.put.mockRejectedValue(new Error('DynamoDB unavailable'));
    await expect(
      service.receive('source-secret', { message: 'test' }),
    ).rejects.toThrow('DynamoDB unavailable');
  });
  it('queries only the owner unread index and filters stale already-read index entries', async () => {
    db.query
      .mockResolvedValueOnce({
        Items: [{ taskId: id }],
        LastEvaluatedKey: {
          userId: owner,
          taskId: id,
          unreadUser: owner,
          receivedOrder: '2026-09-06#' + id,
        },
      })
      .mockResolvedValueOnce({ Items: [{ taskId: 'b'.repeat(64) }] });
    db.get
      .mockResolvedValueOnce({
        Item: { userId: owner, taskId: id, status: 'read' },
      })
      .mockResolvedValueOnce({
        Item: {
          userId: owner,
          taskId: 'b'.repeat(64),
          status: 'unread',
          fingerprint: 'internal',
          unreadUser: owner,
        },
      });
    const result = await service.unread(owner, '1');
    expect(result.items).toEqual([
      { userId: owner, taskId: 'b'.repeat(64), status: 'unread' },
    ]);
    expect(result.nextCursor).toBeNull();
    expect(db.query).toHaveBeenCalledWith(
      expect.objectContaining({
        IndexName: 'unread-received-index',
        ExpressionAttributeValues: { ':user': owner },
        Limit: 1,
      }),
    );
    expect(db.get).toHaveBeenCalledWith(
      expect.objectContaining({
        Key: { userId: owner, taskId: id },
        ConsistentRead: true,
      }),
    );
  });
  it('returns a cursor for another page of unread notifications', async () => {
    const key = {
      userId: owner,
      taskId: id,
      unreadUser: owner,
      receivedOrder: '2026-09-06#' + id,
    };
    db.query.mockResolvedValue({
      Items: [{ taskId: id }],
      LastEvaluatedKey: key,
    });
    db.get.mockResolvedValue({
      Item: { userId: owner, taskId: id, status: 'unread' },
    });
    const first = await service.unread(owner, '1');
    await service.unread(owner, '1', first.nextCursor);
    expect(db.query.mock.calls[1][0].ExclusiveStartKey).toEqual(key);
  });
  it('returns an empty inbox without a cursor', async () => {
    db.query.mockResolvedValue({ Items: [] });
    expect(await service.unread(owner)).toEqual({
      items: [],
      nextCursor: null,
    });
  });
  it('rejects a cursor belonging to another user', async () => {
    const cursor = Buffer.from(
      JSON.stringify({
        userId: other,
        unreadUser: other,
        taskId: id,
        receivedOrder: 'x',
      }),
    ).toString('base64url');
    await expect(service.unread(owner, '20', cursor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(db.query).not.toHaveBeenCalled();
  });
  it.each(['0', '101', 'abc', '1.5'])(
    'rejects invalid limit %s',
    async (value) => {
      await expect(service.unread(owner, value)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );
  it('marks read by owner key and removes unread index attributes atomically', async () => {
    db.update.mockResolvedValue({
      Attributes: { userId: owner, taskId: id, status: 'read', readAt: 'now' },
    });
    expect(await service.markRead(owner, id)).toMatchObject({
      status: 'read',
      readAt: 'now',
    });
    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({
        Key: { userId: owner, taskId: id },
        ConditionExpression: 'attribute_exists(taskId) AND #s = :unread',
        UpdateExpression:
          'SET #s = :read, readAt = :now REMOVE unreadUser, receivedOrder',
      }),
    );
  });
  it('preserves the original readAt on repeated or concurrent acknowledgements', async () => {
    db.update.mockRejectedValue(conditionFailure);
    db.get.mockResolvedValue({
      Item: { userId: owner, taskId: id, status: 'read', readAt: 'original' },
    });
    expect(await service.markRead(owner, id)).toMatchObject({
      readAt: 'original',
    });
  });
  it('history includes old read and unread records using the receivedAt index', async () => {
    db.query.mockResolvedValue({
      Items: [{ taskId: id }, { taskId: 'b'.repeat(64) }],
    });
    db.get
      .mockResolvedValueOnce({
        Item: {
          taskId: id,
          userId: owner,
          status: 'read',
          receivedAt: '2026-09-06T00:00:00Z',
        },
      })
      .mockResolvedValueOnce({
        Item: {
          taskId: 'b'.repeat(64),
          userId: owner,
          status: 'unread',
          receivedAt: '2026-09-05T00:00:00Z',
        },
      });
    const result = await service.history(owner, { days: 'all' });
    expect(result.items.map((item) => item.status)).toEqual(['read', 'unread']);
    expect(db.query.mock.calls[0][0]).toMatchObject({
      IndexName: 'user-received-index',
      ScanIndexForward: false,
      ExpressionAttributeValues: { ':u': owner },
    });
    expect(db.update).not.toHaveBeenCalled();
  });
  it('history rejects cross-user cursors before accessing storage', async () => {
    const cursor = Buffer.from(
      JSON.stringify({
        scope: JSON.stringify([other, 'all', '', '7']),
        key: { userId: other, taskId: id, receivedAt: '2026-09-06' },
        since: '2026-09-01',
      }),
    ).toString('base64url');
    await expect(service.history(owner, { cursor })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(db.query).not.toHaveBeenCalled();
  });
  it('does not acknowledge a task outside the owner partition', async () => {
    db.update.mockRejectedValue(conditionFailure);
    db.get.mockResolvedValue({});
    await expect(service.markRead(other, id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(db.get).toHaveBeenCalledWith(
      expect.objectContaining({ Key: { userId: other, taskId: id } }),
    );
  });
});

describe('notification validation', () => {
  it.each([
    null,
    [],
    {},
    '',
    '   ',
    { event_id: 123 },
    { event_id: '' },
    { message: '中'.repeat(3000) },
  ])('rejects invalid or oversized data: %p', (body) => {
    expect(() => notification(body)).toThrow(BadRequestException);
  });
  it('canonicalizes nested object ordering without reordering arrays', () => {
    expect(canonical({ b: { x: 1, y: 2 }, a: [2, 1] })).toBe(
      canonical({ a: [2, 1], b: { y: 2, x: 1 } }),
    );
    expect(canonical([2, 1])).not.toBe(canonical([1, 2]));
  });
});
