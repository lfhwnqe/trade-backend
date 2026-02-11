import { Injectable } from '@nestjs/common';
import { ConfigService } from '../common/config.service';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import {
  UploadUrlResponse,
  ImageUrlResponse,
  ALLOWED_IMAGE_TYPES,
} from './types/image.types';
import {
  S3Exception,
  ValidationException,
  AuthorizationException,
  ResourceNotFoundException,
  RateLimitException,
} from '../../base/exceptions/custom.exceptions';
import { ERROR_CODES } from '../../base/constants/error-codes';

@Injectable()
export class ImageService {
  private s3Client: S3Client;
  private readonly bucketName: string;
  private readonly cloudfrontDomain: string;
  private readonly allowLegacyPublicImage: boolean;
  private readonly resolveRateLimitPerMinute: number;
  private readonly resolveRateCounters = new Map<string, { minute: number; count: number }>();
  private readonly db: DynamoDBDocument;
  private readonly configTableName: string;

  constructor(private configService: ConfigService) {
    this.s3Client = new S3Client({
      region: this.configService.get('AWS_REGION'),
    });
    this.db = DynamoDBDocument.from(
      new DynamoDB({ region: this.configService.get('AWS_REGION') }),
      { marshallOptions: { convertClassInstanceToMap: true } },
    );
    this.configTableName = this.configService.getOrThrow('CONFIG_TABLE_NAME');

    const bucketName = this.configService.get('IMAGE_BUCKET_NAME');
    if (!bucketName) {
      throw new S3Exception(
        'IMAGE_BUCKET_NAME is not configured',
        ERROR_CODES.S3_CONFIG_ERROR,
        'S3存储服务配置错误，请联系管理员',
        { configKey: 'IMAGE_BUCKET_NAME' },
      );
    }
    this.bucketName = bucketName;

    const cloudfrontDomain = this.configService.get('CLOUDFRONT_DOMAIN_NAME');
    if (!cloudfrontDomain) {
      throw new S3Exception(
        'CLOUDFRONT_DOMAIN_NAME is not configured',
        ERROR_CODES.S3_CONFIG_ERROR,
        'CDN服务配置错误，请联系管理员',
        { configKey: 'CLOUDFRONT_DOMAIN_NAME' },
      );
    }
    this.cloudfrontDomain = cloudfrontDomain;

    this.allowLegacyPublicImage =
      String(this.configService.get('ALLOW_LEGACY_PUBLIC_IMAGE') ?? 'true').toLowerCase() !==
      'false';
    this.resolveRateLimitPerMinute = Number(
      this.configService.get('IMAGE_RESOLVE_RATE_LIMIT_PER_MINUTE') ?? 120,
    );

    console.log('Image Service Configuration:', {
      region: this.configService.get('AWS_REGION'),
      bucketName: this.bucketName,
      cloudfrontDomain: this.cloudfrontDomain,
      allowLegacyPublicImage: this.allowLegacyPublicImage,
      resolveRateLimitPerMinute: this.resolveRateLimitPerMinute,
    });
  }

  /**
   * 生成图片上传URL
   * @param userId 用户ID
   * @param fileName 文件名
   * @param fileType 文件类型
   * @param date 日期 (YYYY-MM-DD)
   * @returns 上传URL和文件key
   */
  private getTodayDateKey() {
    return new Date().toISOString().slice(0, 10);
  }

  private getPlanFromClaims(claims: any): 'free' | 'pro' | 'admin' {
    const role = String(claims?.['custom:role'] || claims?.role || '');
    const groups = (claims?.['cognito:groups'] as string[]) || [];
    const isAdmin =
      role === 'Admins' ||
      role === 'SuperAdmins' ||
      groups.includes('Admins') ||
      groups.includes('SuperAdmins');
    if (isAdmin) return 'admin';
    if (role === 'ProPlan') return 'pro';
    return 'free';
  }

  private getDailyCountLimit(plan: 'free' | 'pro' | 'admin', isApiToken: boolean) {
    if (isApiToken) {
      return Number(this.configService.get('IMAGE_UPLOAD_DAILY_COUNT_API_TOKEN') ?? 60);
    }
    if (plan === 'admin') return Number(this.configService.get('IMAGE_UPLOAD_DAILY_COUNT_ADMIN') ?? 500);
    if (plan === 'pro') return Number(this.configService.get('IMAGE_UPLOAD_DAILY_COUNT_PRO') ?? 120);
    return Number(this.configService.get('IMAGE_UPLOAD_DAILY_COUNT_FREE') ?? 20);
  }

  private getDailyBytesLimit(plan: 'free' | 'pro' | 'admin', isApiToken: boolean) {
    if (isApiToken) {
      return Number(this.configService.get('IMAGE_UPLOAD_DAILY_BYTES_API_TOKEN') ?? 120 * 1024 * 1024);
    }
    if (plan === 'admin') return Number(this.configService.get('IMAGE_UPLOAD_DAILY_BYTES_ADMIN') ?? 2048 * 1024 * 1024);
    if (plan === 'pro') return Number(this.configService.get('IMAGE_UPLOAD_DAILY_BYTES_PRO') ?? 512 * 1024 * 1024);
    return Number(this.configService.get('IMAGE_UPLOAD_DAILY_BYTES_FREE') ?? 64 * 1024 * 1024);
  }


  private getPerMinuteCountLimit(plan: 'free' | 'pro' | 'admin', isApiToken: boolean) {
    if (isApiToken) {
      return Number(this.configService.get('IMAGE_UPLOAD_RATE_LIMIT_PER_MINUTE_API_TOKEN') ?? 20);
    }
    if (plan === 'admin') return Number(this.configService.get('IMAGE_UPLOAD_RATE_LIMIT_PER_MINUTE_ADMIN') ?? 120);
    if (plan === 'pro') return Number(this.configService.get('IMAGE_UPLOAD_RATE_LIMIT_PER_MINUTE_PRO') ?? 40);
    return Number(this.configService.get('IMAGE_UPLOAD_RATE_LIMIT_PER_MINUTE_FREE') ?? 10);
  }
  async consumeUploadQuota(params: {
    userId: string;
    claims?: any;
    authType?: string;
    apiTokenId?: string;
    contentLength?: number;
  }) {
    const { userId, claims, authType, apiTokenId, contentLength } = params;
    const isApiToken = authType === 'apiToken';
    const plan = this.getPlanFromClaims(claims);
    const countLimit = this.getDailyCountLimit(plan, isApiToken);
    const bytesLimit = this.getDailyBytesLimit(plan, isApiToken);
    const minuteLimit = this.getPerMinuteCountLimit(plan, isApiToken);

    const date = this.getTodayDateKey();
    const now = new Date();
    const minuteKey = `${now.toISOString().slice(0, 16)}`; // YYYY-MM-DDTHH:mm
    const actor = isApiToken ? `token:${apiTokenId || 'unknown'}` : 'cognito';
    const configKey = `imageQuota#${date}#${userId}#${actor}`;
    const rateConfigKey = `imageRate#${minuteKey}#${userId}#${actor}`;
    const byteInc =
      typeof contentLength === 'number' && Number.isFinite(contentLength)
        ? Math.max(0, Math.trunc(contentLength))
        : 0;

    try {
      await this.db.update({
        TableName: this.configTableName,
        Key: { configKey: rateConfigKey },
        UpdateExpression:
          'SET #issuedCount = if_not_exists(#issuedCount, :zero) + :one, #updatedAt = :updatedAt, #rateMinute = :rateMinute',
        ConditionExpression:
          '(attribute_not_exists(#issuedCount) OR #issuedCount <= :maxMinuteBefore)',
        ExpressionAttributeNames: {
          '#issuedCount': 'issuedCount',
          '#updatedAt': 'updatedAt',
          '#rateMinute': 'rateMinute',
        },
        ExpressionAttributeValues: {
          ':zero': 0,
          ':one': 1,
          ':updatedAt': now.toISOString(),
          ':rateMinute': minuteKey,
          ':maxMinuteBefore': Math.max(0, minuteLimit - 1),
        },
      });

      await this.db.update({
        TableName: this.configTableName,
        Key: { configKey },
        UpdateExpression:
          'SET #issuedCount = if_not_exists(#issuedCount, :zero) + :one, #issuedBytes = if_not_exists(#issuedBytes, :zero) + :byteInc, #updatedAt = :updatedAt, #quotaDate = :quotaDate',
        ConditionExpression:
          '(attribute_not_exists(#issuedCount) OR #issuedCount <= :maxCountBefore) AND (attribute_not_exists(#issuedBytes) OR #issuedBytes <= :maxBytesBefore)',
        ExpressionAttributeNames: {
          '#issuedCount': 'issuedCount',
          '#issuedBytes': 'issuedBytes',
          '#updatedAt': 'updatedAt',
          '#quotaDate': 'quotaDate',
        },
        ExpressionAttributeValues: {
          ':zero': 0,
          ':one': 1,
          ':byteInc': byteInc,
          ':updatedAt': new Date().toISOString(),
          ':quotaDate': date,
          ':maxCountBefore': Math.max(0, countLimit - 1),
          ':maxBytesBefore': Math.max(0, bytesLimit - byteInc),
        },
      });
    } catch (e: any) {
      if (String(e?.name || '').includes('ConditionalCheckFailed')) {
        const isMinute = String(e?.message || '').includes('maxMinuteBefore') || String(e?.message || '').includes('rateMinute');
        if (isMinute) {
          throw new RateLimitException(
            `upload rate limit exceeded for ${userId}`,
            ERROR_CODES.IMAGE_RATE_LIMITED,
            '上传过于频繁，请稍后重试',
            { userId, actor, minuteLimit, minuteKey },
          );
        }
        throw new RateLimitException(
          `upload quota exceeded for ${userId}`,
          ERROR_CODES.IMAGE_QUOTA_EXCEEDED,
          '图片上传额度已达上限，请明天再试或升级套餐',
          { userId, actor, countLimit, bytesLimit },
        );
      }
      throw e;
    }
  }

  async generateUploadUrl(
    userId: string,
    fileName: string,
    fileType: string,
    date: string,
  ): Promise<UploadUrlResponse> {
    // 兼容旧接口：走 unbound trade 路径
    return this.generateTradeUploadUrl(userId, {
      fileName,
      fileType,
      date,
      transactionId: undefined,
      source: 'legacy-image-module',
    });
  }

  async generateTradeUploadUrl(
    userId: string,
    params: {
      fileName: string;
      fileType: string;
      date: string;
      transactionId?: string;
      contentLength?: number;
      source?: string;
    },
  ): Promise<UploadUrlResponse> {
    const { fileName, fileType, date, transactionId, contentLength } = params;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new ValidationException(
        `Invalid date format: ${date}. Expected YYYY-MM-DD format`,
        ERROR_CODES.VALIDATION_DATE_FORMAT_INVALID,
        '日期格式无效，请使用 YYYY-MM-DD 格式',
        { providedDate: date, expectedFormat: 'YYYY-MM-DD' },
      );
    }

    if (!ALLOWED_IMAGE_TYPES.includes(fileType as any)) {
      throw new ValidationException(
        `Unsupported file type: ${fileType}`,
        ERROR_CODES.IMAGE_FORMAT_INVALID,
        '不支持的文件类型',
        { fileType, allowed: ALLOWED_IMAGE_TYPES },
      );
    }

    const maxSizeBytes = Number(this.configService.get('IMAGE_UPLOAD_MAX_SIZE_BYTES') ?? 5 * 1024 * 1024);
    if (
      typeof contentLength === 'number' &&
      Number.isFinite(contentLength) &&
      contentLength > maxSizeBytes
    ) {
      throw new ValidationException(
        `Image file too large: ${contentLength}`,
        ERROR_CODES.IMAGE_SIZE_EXCEEDED,
        `图片大小超过限制（最大 ${maxSizeBytes} 字节）`,
        { contentLength, maxSizeBytes },
      );
    }

    const timestamp = Date.now();
    const safeTransactionId = transactionId?.trim() || 'unbound';
    const key = `uploads/${userId}/${safeTransactionId}/${date}/${timestamp}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: fileType,
    });

    const signedUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 300,
    });

    return {
      success: true,
      data: {
        uploadUrl: signedUrl,
        key,
      },
    };
  }

  /**
   * 获取图片的CloudFront URL
   * @param key 图片的S3 key
   * @returns CloudFront URL
   */
  async getImageUrl(key: string): Promise<ImageUrlResponse> {
    const cloudfrontUrl = `https://${this.cloudfrontDomain}/${key}`;

    return {
      success: true,
      data: {
        url: cloudfrontUrl,
      },
    };
  }

  private isHttpUrl(ref: string) {
    return /^https?:\/\//i.test(ref);
  }

  private parseLegacyOwnerFromUrl(ref: string): string | null {
    try {
      const u = new URL(ref);
      const pathname = u.pathname.replace(/^\/+/, '');
      const parts = pathname.split('/').filter(Boolean);

      // 支持两种常见格式：
      // 1) images/{ownerId}/...
      // 2) {bucket}/images/{ownerId}/... (path-style)
      if (parts.length >= 2 && parts[0] === 'images') {
        return parts[1] || null;
      }
      if (parts.length >= 3 && parts[1] === 'images') {
        return parts[2] || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  private checkResolveRateLimit(userId: string) {
    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const current = this.resolveRateCounters.get(userId);

    if (!current || current.minute !== minute) {
      this.resolveRateCounters.set(userId, { minute, count: 1 });
      return;
    }

    if (current.count >= this.resolveRateLimitPerMinute) {
      throw new RateLimitException(
        `resolve rate limit exceeded for user ${userId}`,
        ERROR_CODES.IMAGE_RATE_LIMITED,
        '图片解析请求过于频繁，请稍后重试',
        { userId, limit: this.resolveRateLimitPerMinute, minute },
      );
    }

    current.count += 1;
    this.resolveRateCounters.set(userId, current);
  }

  private isOwnedKey(userId: string, key: string) {
    return key.startsWith(`images/${userId}/`) || key.startsWith(`uploads/${userId}/`);
  }

  async resolveTradeImageRefs(userId: string, refs: string[]) {
    this.checkResolveRateLimit(userId);

    const safeRefs = Array.isArray(refs) ? refs.slice(0, 100) : [];

    const items = await Promise.all(
      safeRefs.map(async (refRaw) => {
        const ref = String(refRaw || '').trim();
        if (!ref) {
          return { ref, kind: 'invalid', url: '' };
        }

        if (this.isHttpUrl(ref)) {
          if (!this.allowLegacyPublicImage) {
            throw new AuthorizationException(
              `Legacy public image resolve disabled: ${ref}`,
              ERROR_CODES.IMAGE_LEGACY_DISABLED,
              '历史公开图片解析已关闭',
              { ref },
            );
          }

          const legacyOwner = this.parseLegacyOwnerFromUrl(ref);
          if (!legacyOwner) {
            throw new ValidationException(
              `Unsupported legacy image url format: ${ref}`,
              ERROR_CODES.VALIDATION_INVALID_FORMAT,
              '历史图片链接格式不受支持',
              { ref },
            );
          }

          if (legacyOwner !== userId) {
            throw new AuthorizationException(
              `Legacy image url not owned by current user: ${ref}`,
              ERROR_CODES.RESOURCE_ACCESS_DENIED,
              '图片访问越权',
              { ref, owner: legacyOwner, userId },
            );
          }

          return {
            ref,
            kind: 'legacy_public',
            url: ref,
          };
        }

        if (!this.isOwnedKey(userId, ref)) {
          throw new AuthorizationException(
            `Image ref is not owned by current user: ${ref}`,
            ERROR_CODES.RESOURCE_ACCESS_DENIED,
            '图片访问越权',
            { ref },
          );
        }

        try {
          await this.s3Client.send(
            new HeadObjectCommand({
              Bucket: this.bucketName,
              Key: ref,
            }),
          );
        } catch {
          throw new ResourceNotFoundException(
            `Image key not found: ${ref}`,
            ERROR_CODES.RESOURCE_NOT_FOUND,
            '图片不存在',
            { ref },
          );
        }

        const signedUrl = await getSignedUrl(
          this.s3Client,
          new GetObjectCommand({
            Bucket: this.bucketName,
            Key: ref,
          }),
          { expiresIn: 300 },
        );

        return {
          ref,
          kind: 'private_key',
          url: signedUrl,
          expiresInSec: 300,
        };
      }),
    );

    return {
      success: true,
      data: {
        items,
      },
    };
  }

  /**
   * 删除图片
   * @param key 图片的S3 key
   * @returns 删除结果
   */
  async listUserUploadObjects(userId: string, maxKeys = 3000) {
    const prefix = `uploads/${userId}/`;
    const objects: Array<{ key: string; lastModified?: string }> = [];
    let continuationToken: string | undefined;

    do {
      const res = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: prefix,
          ContinuationToken: continuationToken,
          MaxKeys: 1000,
        }),
      );

      for (const item of res.Contents || []) {
        const key = String(item.Key || '');
        if (!key) continue;
        objects.push({
          key,
          lastModified: item.LastModified?.toISOString(),
        });
        if (objects.length >= maxKeys) {
          return objects;
        }
      }

      continuationToken = res.IsTruncated
        ? res.NextContinuationToken
        : undefined;
    } while (continuationToken && objects.length < maxKeys);

    return objects;
  }

  async deleteImagesByKeys(keys: string[]) {
    const deleted: string[] = [];
    const failed: Array<{ key: string; error: string }> = [];

    for (const key of keys) {
      try {
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: key,
          }),
        );
        deleted.push(key);
      } catch (error: any) {
        failed.push({ key, error: String(error?.message || error) });
      }
    }

    return { deleted, failed };
  }

  async deleteImage(key: string) {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    try {
      await this.s3Client.send(command);
      return {
        success: true,
        message: '图片删除成功',
      };
    } catch (error) {
      console.error('Delete S3 image error:', error);
      throw new S3Exception(
        `Failed to delete image from S3: ${error.message}`,
        ERROR_CODES.S3_DELETE_FAILED,
        '图片删除失败，请稍后重试',
        { key, originalError: error.message },
      );
    }
  }
}
