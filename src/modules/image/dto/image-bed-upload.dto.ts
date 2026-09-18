import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { ALLOWED_IMAGE_TYPES } from '../types/image.types';

export class ImageBedUploadDto {
  @ApiProperty({ example: '0001-01.png' })
  @IsString()
  @MaxLength(240)
  @Matches(/^[^/\\\u0000-\u001f]+$/)
  fileName: string;

  @ApiProperty({ example: 'image/png' })
  @IsIn(ALLOWED_IMAGE_TYPES)
  fileType: string;

  @ApiProperty({ example: '2026-09-17' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @ApiPropertyOptional({ description: '实际文件字节数；API Token 上传必填' })
  @IsOptional()
  @IsInt()
  @Min(1)
  contentLength?: number;
}
