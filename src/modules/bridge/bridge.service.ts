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
