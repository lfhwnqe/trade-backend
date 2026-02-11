import {
  Controller,
  Post,
  Body,
  Req,
  Get,
  Param,
  UseFilters,
  Delete,
} from '@nestjs/common';
import { ImageService } from './image.service';
import { Request } from 'express';
import { ALLOWED_IMAGE_TYPES, UploadImageRequest } from './types/image.types';
import { HttpExceptionFilter } from 'src/base/filters/http-exception.filter';
import {
  ValidationException,
  AuthenticationException,
  AuthorizationException,
} from '../../base/exceptions/custom.exceptions';
import { ERROR_CODES } from '../../base/constants/error-codes';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';

@ApiTags('图片管理')
@ApiBearerAuth()
@Controller('image')
@UseFilters(HttpExceptionFilter)
export class ImageController {
  constructor(private readonly imageService: ImageService) {}

  @ApiOperation({ summary: '获取图片上传URL' })
  @ApiBody({
    schema: {
      properties: {
        fileName: { type: 'string', example: 'image.jpg' },
        fileType: { type: 'string', example: 'image/jpeg' },
        date: { type: 'string', example: '2023-05-23' },
      },
    },
  })
  @ApiResponse({ status: 200, description: '返回上传URL和其他相关信息' })
  @ApiResponse({ status: 400, description: '不支持的文件类型' })
  @ApiResponse({ status: 401, description: '用户未认证' })
  @Post('upload-url')
  async getUploadUrl(@Body() body: UploadImageRequest, @Req() req: Request) {
    const { fileName, fileType, date } = body;

    console.log('Image Upload URL request:', {
      user: req['user'],
      fileName,
      fileType,
      date,
    });

    // 验证文件类型
    if (!ALLOWED_IMAGE_TYPES.includes(fileType)) {
      throw new ValidationException(
        `Unsupported file type: ${fileType}. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`,
        ERROR_CODES.IMAGE_FORMAT_INVALID,
        `不支持的文件类型。支持的类型: ${ALLOWED_IMAGE_TYPES.join(', ')}`,
        { providedType: fileType, allowedTypes: ALLOWED_IMAGE_TYPES },
      );
    }

    // 验证用户身份
    if (!req['user']?.sub) {
      console.error('Auth error:', {
        user: req['user'],
        headers: req.headers,
      });
      throw new AuthenticationException(
        'User authentication failed: missing user.sub',
        ERROR_CODES.AUTH_TOKEN_MISSING,
        '用户未认证',
        { user: req['user'] },
      );
    }

    const claims = (req as any).user?.claims || (req as any).user;
    const role = String(claims?.['custom:role'] || claims?.role || '');
    const groups: string[] =
      (claims?.['cognito:groups'] as string[]) ||
      (req as any).user?.groups ||
      [];
    const isAdmin =
      role === 'Admins' ||
      role === 'SuperAdmins' ||
      groups.includes('Admins') ||
      groups.includes('SuperAdmins');
    if (!isAdmin) {
      throw new AuthorizationException(
        'Only Admins/SuperAdmins can use legacy image upload endpoint',
        ERROR_CODES.AUTH_UNAUTHORIZED,
        '仅管理员可使用图床上传接口',
      );
    }

    const userId = req['user'].sub;

    return this.imageService.generateUploadUrl(
      userId,
      fileName,
      fileType,
      date,
    );
  }

  @ApiOperation({ summary: '获取图片访问URL' })
  @ApiParam({ name: 'key', description: '图片存储的键值' })
  @ApiResponse({ status: 200, description: '返回图片访问URL' })
  @Get('url/:key')
  async getImageUrl(@Param('key') key: string) {
    return this.imageService.getImageUrl(key);
  }

  @ApiOperation({ summary: '删除图片' })
  @ApiParam({ name: 'key', description: '图片存储的键值' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 401, description: '用户未认证或无权删除图片' })
  @Delete(':key')
  async deleteImage(@Param('key') key: string, @Req() req: Request) {
    // 验证用户身份
    if (!req['user']?.sub) {
      throw new AuthenticationException(
        'User authentication failed: missing user.sub',
        ERROR_CODES.AUTH_TOKEN_MISSING,
        '用户未认证',
        { user: req['user'] },
      );
    }

    // 验证文件所有权（可选，根据key中的用户ID判断）
    const userId = req['user'].sub;
    const keyParts = key.split('/');

    // 检查key格式是否为 images/日期/用户ID/文件名
    if (
      keyParts.length >= 3 &&
      keyParts[0] === 'images' &&
      keyParts[2] !== userId
    ) {
      throw new AuthorizationException(
        `User ${userId} attempted to delete image owned by ${keyParts[2]}`,
        ERROR_CODES.IMAGE_DELETE_PERMISSION_DENIED,
        '无权删除其他用户的图片',
        { userId, keyUserId: keyParts[2], key },
      );
    }

    return this.imageService.deleteImage(key);
  }
}
