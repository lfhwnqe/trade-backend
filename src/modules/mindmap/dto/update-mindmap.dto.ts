/**
 * 更新脑图DTO
 */

import { IsString, IsOptional, IsArray, IsObject, Length, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { MindMapNodeData, UpdateMindMapRequest } from '../types/mindmap.types';

export class UpdateMindMapDto implements UpdateMindMapRequest {
  @IsOptional()
  @IsString()
  @Length(1, 200, { message: '标题长度必须在1-200个字符之间' })
  title?: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000, { message: '描述长度不能超过1000个字符' })
  description?: string;

  @IsOptional()
  @IsObject()
  @Type(() => Object)
  data?: MindMapNodeData;

  @IsOptional()
  @IsString()
  layout?: string;

  @IsOptional()
  @IsString()
  theme?: string;

  @IsOptional()
  @IsObject()
  @Type(() => Object)
  viewData?: any;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10, { message: '标签数量不能超过10个' })
  tags?: string[];
}
