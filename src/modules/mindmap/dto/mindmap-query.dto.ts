/**
 * 脑图查询参数DTO
 */

import { IsOptional, IsNumber, IsArray, IsString, IsIn, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { MindMapQueryParams, MINDMAP_DEFAULTS } from '../types/mindmap.types';

export class MindMapQueryDto implements MindMapQueryParams {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: '页码必须是数字' })
  @Min(1, { message: '页码必须大于0' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: '每页大小必须是数字' })
  @Min(1, { message: '每页大小必须大于0' })
  @Max(MINDMAP_DEFAULTS.MAX_PAGE_SIZE, { message: `每页大小不能超过${MINDMAP_DEFAULTS.MAX_PAGE_SIZE}` })
  pageSize?: number = MINDMAP_DEFAULTS.PAGE_SIZE;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    }
    return value;
  })
  tags?: string[];

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  @IsIn(['createdAt', 'updatedAt', 'title'], { message: '排序字段必须是createdAt、updatedAt或title' })
  sortBy?: 'createdAt' | 'updatedAt' | 'title' = 'updatedAt';

  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'], { message: '排序方向必须是asc或desc' })
  sortOrder?: 'asc' | 'desc' = 'desc';
}
