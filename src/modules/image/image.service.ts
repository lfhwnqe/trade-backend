import { Injectable } from '@nestjs/common';
import { ConfigService } from '../common/config.service';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { UploadUrlResponse, ImageUrlResponse } from './types/image.types';
import {
  S3Exception,
  ValidationException,
} from '../../base/exceptions/custom.exceptions';
import { ERROR_CODES } from '../../base/constants/error-codes';

@Injectable()
export class ImageService {
  private s3Client: S3Client;
  private readonly bucketName: string;
  private readonly cloudfrontDomain: string;

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

    console.log('Image Service Configuration:', {
      region: this.configService.get('AWS_REGION'),
      bucketName: this.bucketName,
      cloudfrontDomain: this.cloudfrontDomain,
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
    // 验证日期格式
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new ValidationException(
        `Invalid date format: ${date}. Expected YYYY-MM-DD format`,
        ERROR_CODES.VALIDATION_DATE_FORMAT_INVALID,
        '日期格式无效，请使用 YYYY-MM-DD 格式',
        { providedDate: date, expectedFormat: 'YYYY-MM-DD' },
      );
    }

    // 构建文件路径: images/用户ID/日期/时间戳-文件名
    const timestamp = Date.now();
    const key = `images/${userId}/${date}/${timestamp}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: fileType,
    });

    const signedUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 3600, // URL 有效期1小时
    });

    return {
      success: true,
      data: {
        uploadUrl: signedUrl,
        key: key,
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
