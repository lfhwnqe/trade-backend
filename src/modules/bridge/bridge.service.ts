import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { createHash, randomUUID } from 'node:crypto';
import { ConfigService } from '../common/config.service';
import { BridgeHooksService } from './bridge-hooks.service';
import { BridgeAccessService } from './bridge-access.service';
import { canonical, notification, taskId } from './bridge.validation';

export type BridgeTask = {
  userId: string;
  taskId: string;
  hookId: string;
  payload: Record<string, unknown>;
  status: 'unread' | 'read';
  receivedAt: string;
  readAt?: string;
  fingerprint: string;
  unreadUser?: string;
  receivedOrder?: string;
};

@Injectable()
export class BridgeService {
  private readonly db: DynamoDBDocument;
  constructor(
    private readonly config: ConfigService,
    private readonly hooks: BridgeHooksService,
    private readonly access: BridgeAccessService,
  ) {
    this.db = DynamoDBDocument.from(
      new DynamoDB({ region: config.getOrThrow('AWS_REGION') }),
      { marshallOptions: { removeUndefinedValues: true } },
    );
  }
  private get table() {
    const name = this.config.get('BRIDGE_TABLE_NAME');
    if (!name) throw new ServiceUnavailableException('Bridge not configured');
    return name;
  }
  private async get(
    userId: string,
    id: string,
  ): Promise<BridgeTask | undefined> {
    return (
      await this.db.get({
        TableName: this.table,
        Key: { userId, taskId: taskId(id) },
        ConsistentRead: true,
      })
    ).Item as BridgeTask | undefined;
  }
  private publicTask(item: BridgeTask) {
    const { fingerprint, unreadUser, receivedOrder, ...result } = item;
    return result;
  }
  async receive(triggerToken: string, body: unknown) {
    const { payload, eventId } = notification(body);
    const auth = await this.hooks.authenticate(triggerToken);
    await this.access.assertOwner(auth.userId);
    const id = createHash('sha256')
      .update(
        JSON.stringify([auth.userId, auth.hookId, eventId ?? randomUUID()]),
      )
      .digest('hex');
    const fingerprint = createHash('sha256')
      .update(canonical(payload))
      .digest('hex');
    const receivedAt = new Date().toISOString();
    const item: BridgeTask = {
      userId: auth.userId,
      taskId: id,
      hookId: auth.hookId,
      payload,
      fingerprint,
      status: 'unread',
      receivedAt,
      unreadUser: auth.userId,
      receivedOrder: `${receivedAt}#${id}`,
    };
    try {
      await this.db.put({
        TableName: this.table,
        Item: item,
        ConditionExpression: 'attribute_not_exists(taskId)',
      });
      return { taskId: id, status: item.status, duplicate: false };
    } catch (error: any) {
      if (error?.name !== 'ConditionalCheckFailedException') throw error;
      const old = await this.get(auth.userId, id);
      if (!old || old.fingerprint !== fingerprint)
        throw new ConflictException(
          'event_id reused with a different notification',
        );
      return { taskId: id, status: old.status, duplicate: true };
    }
  }
  private decodeCursor(userId: string, cursor?: string) {
    if (!cursor) return undefined;
    try {
      if (typeof cursor !== 'string' || cursor.length > 2048) throw new Error();
      const key = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
      if (
        !key ||
        Object.keys(key).sort().join(',') !==
          'receivedOrder,taskId,unreadUser,userId' ||
        key.userId !== userId ||
        key.unreadUser !== userId ||
        typeof key.receivedOrder !== 'string' ||
        key.receivedOrder.length > 120
      )
        throw new Error();
      taskId(key.taskId);
      return key;
    } catch {
      throw new BadRequestException('Invalid bridge cursor');
    }
  }
  async unread(userId: string, limitValue?: string, cursor?: string) {
    if (
      limitValue !== undefined &&
      (typeof limitValue !== 'string' || !/^\d+$/.test(limitValue))
    ) {
      throw new BadRequestException('limit must be 1-100');
    }
    const limit = limitValue === undefined ? 20 : Number(limitValue);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new BadRequestException('limit must be 1-100');
    let startKey = this.decodeCursor(userId, cursor);
    // Read past pages whose GSI entries have not yet caught up with read acknowledgements.
    do {
      const page = await this.db.query({
        TableName: this.table,
        IndexName: 'unread-received-index',
        KeyConditionExpression: 'unreadUser = :user',
        ExpressionAttributeValues: { ':user': userId },
        Limit: limit,
        ExclusiveStartKey: startKey,
        ScanIndexForward: true,
      });
      const candidates = await Promise.all(
        (page.Items || []).map((item) => this.get(userId, item.taskId)),
      );
      const items = candidates
        .filter(
          (item): item is BridgeTask => !!item && item.status === 'unread',
        )
        .map((item) => this.publicTask(item));
      startKey = page.LastEvaluatedKey;
      if (items.length || !startKey)
        return {
          items,
          nextCursor: startKey
            ? Buffer.from(JSON.stringify(startKey)).toString('base64url')
            : null,
        };
    } while (startKey);
  }
  async history(userId: string, query: Record<string, string>) {
    const {
      status = 'all',
      hookId = '',
      days = '7',
      limit: rawLimit = '20',
      cursor,
    } = query;
    if (
      ![status, hookId, days, rawLimit].every(
        (value) => typeof value === 'string',
      ) ||
      !['all', 'unread', 'read'].includes(status) ||
      !['7', '30', '90', 'all'].includes(days) ||
      !/^\d+$/.test(rawLimit) ||
      Number(rawLimit) < 1 ||
      Number(rawLimit) > 100 ||
      (hookId && !/^[a-f0-9-]{36}$/.test(hookId))
    )
      throw new BadRequestException('Invalid history filters');
    const limit = Number(rawLimit);
    const scope = JSON.stringify([userId, status, hookId, days]);
    let since =
      days === 'all'
        ? '1970-01-01T00:00:00.000Z'
        : new Date(Date.now() - Number(days) * 86400000).toISOString();
    let key: Record<string, any> | undefined;
    if (cursor) {
      try {
        if (typeof cursor !== 'string' || cursor.length > 4096)
          throw new Error();
        const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString());
        key = decoded.key;
        if (
          decoded.scope !== scope ||
          !key ||
          key.userId !== userId ||
          Object.keys(key).sort().join(',') !== 'receivedAt,taskId,userId' ||
          typeof key.receivedAt !== 'string' ||
          typeof decoded.since !== 'string' ||
          !Number.isFinite(Date.parse(decoded.since))
        )
          throw new Error();
        taskId(key.taskId);
        since = decoded.since;
      } catch {
        throw new BadRequestException('Invalid history cursor');
      }
    }
    const items: Omit<
      BridgeTask,
      'fingerprint' | 'unreadUser' | 'receivedOrder'
    >[] = [];
    for (let pageNo = 0; pageNo < 5; pageNo++) {
      const page = await this.db.query({
        TableName: this.table,
        IndexName: 'user-received-index',
        KeyConditionExpression: 'userId = :u AND receivedAt >= :since',
        ExpressionAttributeValues: { ':u': userId, ':since': since },
        ScanIndexForward: false,
        Limit: limit - items.length,
        ExclusiveStartKey: key,
      });
      const rows = await Promise.all(
        (page.Items || []).map((item) => this.get(userId, item.taskId)),
      );
      for (const item of rows) {
        if (
          item &&
          (status === 'all' || item.status === status) &&
          (!hookId || item.hookId === hookId)
        )
          items.push(this.publicTask(item));
      }
      key = page.LastEvaluatedKey;
      if (!key || items.length >= limit) break;
    }
    return {
      items,
      nextCursor: key
        ? Buffer.from(JSON.stringify({ key, scope, since })).toString(
            'base64url',
          )
        : null,
    };
  }

  async markRead(userId: string, id: string) {
    const key = { userId, taskId: taskId(id) };
    try {
      const result = await this.db.update({
        TableName: this.table,
        Key: key,
        ConditionExpression: 'attribute_exists(taskId) AND #s = :unread',
        UpdateExpression:
          'SET #s = :read, readAt = :now REMOVE unreadUser, receivedOrder',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':unread': 'unread',
          ':read': 'read',
          ':now': new Date().toISOString(),
        },
        ReturnValues: 'ALL_NEW',
      });
      return this.publicTask(result.Attributes as BridgeTask);
    } catch (error: any) {
      if (error?.name !== 'ConditionalCheckFailedException') throw error;
      const old = await this.get(userId, id);
      if (!old) throw new NotFoundException('Bridge task not found');
      if (old.status !== 'read')
        throw new ConflictException('Bridge task state changed');
      return this.publicTask(old);
    }
  }
}
