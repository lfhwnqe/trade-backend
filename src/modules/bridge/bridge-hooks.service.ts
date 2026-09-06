import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { ConfigService } from '../common/config.service';

type Hook = {
  hookId: string;
  userId: string;
  name: string;
  secretHash: string;
  createdAt: string;
  revokedAt?: string;
};

@Injectable()
export class BridgeHooksService {
  private readonly db: DynamoDBDocument;
  constructor(private readonly config: ConfigService) {
    this.db = DynamoDBDocument.from(
      new DynamoDB({ region: config.getOrThrow('AWS_REGION') }),
      { marshallOptions: { removeUndefinedValues: true } },
    );
  }
  private get table() {
    const name = this.config.get('BRIDGE_HOOKS_TABLE_NAME');
    if (!name)
      throw new ServiceUnavailableException('Bridge hooks not configured');
    return name;
  }
  private hash(secret: string) {
    return createHash('sha256').update(secret).digest('hex');
  }
  private publicHook(hook: Hook) {
    const { secretHash, ...result } = hook;
    return result;
  }
  private reveal(hook: Hook, secret: string) {
    return {
      ...this.publicHook(hook),
      webhookPath: `/webhook/bridge/bh_${hook.hookId}.${secret}`,
    };
  }
  private validId(id: string) {
    if (!/^[a-f0-9-]{36}$/.test(id || ''))
      throw new BadRequestException('Invalid hookId');
    return id;
  }
  private async get(id: string): Promise<Hook | undefined> {
    return (
      await this.db.get({
        TableName: this.table,
        Key: { hookId: this.validId(id) },
        ConsistentRead: true,
      })
    ).Item as Hook | undefined;
  }
  async create(userId: string, body: unknown) {
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).some((k) => k !== 'name')
    )
      throw new BadRequestException('Only name is accepted');
    const name = (body as { name?: unknown }).name;
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 64)
      throw new BadRequestException('Name must be 1-64 characters');
    const secret = randomBytes(32).toString('base64url');
    const hook: Hook = {
      hookId: randomUUID(),
      userId,
      name: name.trim(),
      secretHash: this.hash(secret),
      createdAt: new Date().toISOString(),
    };
    await this.db.put({
      TableName: this.table,
      Item: hook,
      ConditionExpression: 'attribute_not_exists(hookId)',
    });
    return this.reveal(hook, secret);
  }
  async list(userId: string, cursor?: string) {
    let key: Record<string, string> | undefined;
    if (cursor) {
      try {
        if (typeof cursor !== 'string' || cursor.length > 2048)
          throw new Error();
        key = JSON.parse(Buffer.from(cursor, 'base64url').toString());
        if (
          !key ||
          Object.keys(key).sort().join(',') !== 'createdAt,hookId,userId' ||
          key.userId !== userId ||
          typeof key.createdAt !== 'string'
        )
          throw new Error();
        this.validId(key.hookId);
      } catch {
        throw new BadRequestException('Invalid hook cursor');
      }
    }
    const page = await this.db.query({
      TableName: this.table,
      IndexName: 'user-created-index',
      KeyConditionExpression: 'userId = :u',
      ExpressionAttributeValues: { ':u': userId },
      Limit: 20,
      ScanIndexForward: false,
      ExclusiveStartKey: key,
    });
    // Refresh the base records so a just-revoked hook is not shown as active.
    const hooks = await Promise.all(
      (page.Items || []).map((item) => this.get(item.hookId)),
    );
    return {
      items: hooks
        .filter((hook) => hook && hook.userId === userId)
        .map((hook) => this.publicHook(hook)),
      nextCursor: page.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(page.LastEvaluatedKey)).toString(
            'base64url',
          )
        : null,
    };
  }
  async revoke(userId: string, hookId: string) {
    try {
      const result = await this.db.update({
        TableName: this.table,
        Key: { hookId: this.validId(hookId) },
        ConditionExpression: 'userId = :u',
        UpdateExpression: 'SET revokedAt = if_not_exists(revokedAt, :now)',
        ExpressionAttributeValues: {
          ':u': userId,
          ':now': new Date().toISOString(),
        },
        ReturnValues: 'ALL_NEW',
      });
      return this.publicHook(result.Attributes as Hook);
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException')
        throw new NotFoundException('Hook not found');
      throw error;
    }
  }
  async rotate(userId: string, hookId: string) {
    const secret = randomBytes(32).toString('base64url');
    try {
      const result = await this.db.update({
        TableName: this.table,
        Key: { hookId: this.validId(hookId) },
        ConditionExpression: 'userId = :u AND attribute_not_exists(revokedAt)',
        UpdateExpression: 'SET secretHash = :hash',
        ExpressionAttributeValues: { ':u': userId, ':hash': this.hash(secret) },
        ReturnValues: 'ALL_NEW',
      });
      return this.reveal(result.Attributes as Hook, secret);
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException')
        throw new NotFoundException('Active hook not found');
      throw error;
    }
  }
  async authenticate(token: string) {
    const match = /^bh_([a-f0-9-]{36})\.([A-Za-z0-9_-]{43})$/.exec(token || '');
    if (!match) throw new ForbiddenException('Invalid Bridge hook');
    const hook = await this.get(match[1]);
    if (
      !hook ||
      hook.revokedAt ||
      !/^[a-f0-9]{64}$/.test(hook.secretHash) ||
      !timingSafeEqual(
        Buffer.from(hook.secretHash, 'hex'),
        Buffer.from(this.hash(match[2]), 'hex'),
      )
    )
      throw new ForbiddenException('Invalid Bridge hook');
    return { hookId: hook.hookId, userId: hook.userId };
  }
}
