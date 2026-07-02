import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, IsUrl, MaxLength, ValidateIf } from 'class-validator';
import {
  PLAYBOOK_TEMPLATE_STATUS_VALUES,
  PlaybookTemplateStatus,
} from '../playbook-template.types';

export class UpdatePlaybookTemplateDto {
  @ApiPropertyOptional({ example: 'range_breakout', description: '来自 playbook_type 分类的剧本编码' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  playbookType?: string;

  @ApiPropertyOptional({ example: '标准突破回踩' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  title?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/playbook-templates/u1/2026-07-02/analysis/a.png' })
  @IsOptional()
  @IsString()
  @ValidateIf((_, value) => value !== '')
  @IsUrl()
  analysisImageUrl?: string;

  @ApiPropertyOptional({ example: 'playbook-templates/u1/2026-07-02/analysis/a.png' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  analysisImageKey?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/playbook-templates/u1/2026-07-02/in-progress/b.png' })
  @IsOptional()
  @IsString()
  @ValidateIf((_, value) => value !== '')
  @IsUrl()
  inProgressImageUrl?: string;

  @ApiPropertyOptional({ example: 'playbook-templates/u1/2026-07-02/in-progress/b.png' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  inProgressImageKey?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/playbook-templates/u1/2026-07-02/completed-trend/c.png' })
  @IsOptional()
  @IsString()
  @ValidateIf((_, value) => value !== '')
  @IsUrl()
  completedTrendImageUrl?: string;

  @ApiPropertyOptional({ example: 'playbook-templates/u1/2026-07-02/completed-trend/c.png' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  completedTrendImageKey?: string;

  @ApiPropertyOptional({ example: '空字符串表示清空备注。' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @ApiPropertyOptional({ enum: PLAYBOOK_TEMPLATE_STATUS_VALUES })
  @IsOptional()
  @IsString()
  @IsIn(PLAYBOOK_TEMPLATE_STATUS_VALUES)
  status?: PlaybookTemplateStatus;
}
