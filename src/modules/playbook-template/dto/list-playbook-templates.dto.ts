import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  PLAYBOOK_TEMPLATE_SORT_BY_VALUES,
  PLAYBOOK_TEMPLATE_SORT_ORDER_VALUES,
  PLAYBOOK_TEMPLATE_STATUS_FILTER_VALUES,
  PlaybookTemplateSortBy,
  PlaybookTemplateSortOrder,
  PlaybookTemplateStatusFilter,
} from '../playbook-template.types';

export class ListPlaybookTemplatesDto {
  @ApiPropertyOptional({ example: 20, default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @ApiPropertyOptional({ description: '分页游标，由上一次查询返回的 nextCursor 透传' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ description: '剧本类型编码（精确匹配，来自 playbook_type）', example: 'range_breakout' })
  @IsOptional()
  @IsString()
  playbookType?: string;

  @ApiPropertyOptional({ enum: PLAYBOOK_TEMPLATE_STATUS_FILTER_VALUES, default: 'ALL' })
  @IsOptional()
  @IsIn(PLAYBOOK_TEMPLATE_STATUS_FILTER_VALUES)
  status?: PlaybookTemplateStatusFilter;

  @ApiPropertyOptional({ description: '模板名称 / 备注关键词（模糊匹配）', example: '回踩' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ enum: PLAYBOOK_TEMPLATE_SORT_BY_VALUES, default: 'CREATED_AT' })
  @IsOptional()
  @IsIn(PLAYBOOK_TEMPLATE_SORT_BY_VALUES)
  sortBy?: PlaybookTemplateSortBy;

  @ApiPropertyOptional({ enum: PLAYBOOK_TEMPLATE_SORT_ORDER_VALUES, default: 'desc' })
  @IsOptional()
  @IsIn(PLAYBOOK_TEMPLATE_SORT_ORDER_VALUES)
  sortOrder?: PlaybookTemplateSortOrder;
}
