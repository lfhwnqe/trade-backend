import { Injectable } from '@nestjs/common';
import { ConfigService } from '../common/config.service';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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

  constructor(private configService: ConfigService) {
    this.s3Client = new S3Client({
      region: this.configService.get('AWS_REGION'),
    });

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
