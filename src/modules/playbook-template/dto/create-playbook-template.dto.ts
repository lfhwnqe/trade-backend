import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import {
  PLAYBOOK_TEMPLATE_STATUS_VALUES,
  PlaybookTemplateStatus,
} from '../playbook-template.types';

export class CreatePlaybookTemplateDto {
  @ApiProperty({ example: 'range_breakout', description: '来自 playbook_type 分类的剧本编码' })
  @IsString()
  @MaxLength(100)
  playbookType: string;

  @ApiProperty({ example: '标准突破回踩' })
  @IsString()
  @MaxLength(60)
  title: string;

  @ApiProperty({ example: 'https://cdn.example.com/playbook-templates/u1/2026-07-02/analysis/a.png' })
  @IsString()
  @IsUrl()
  analysisImageUrl: string;

  @ApiPropertyOptional({ example: 'playbook-templates/u1/2026-07-02/analysis/a.png' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  analysisImageKey?: string;

  @ApiProperty({ example: 'https://cdn.example.com/playbook-templates/u1/2026-07-02/in-progress/b.png' })
  @IsString()
  @IsUrl()
  inProgressImageUrl: string;

  @ApiPropertyOptional({ example: 'playbook-templates/u1/2026-07-02/in-progress/b.png' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  inProgressImageKey?: string;

  @ApiProperty({ example: 'https://cdn.example.com/playbook-templates/u1/2026-07-02/completed-trend/c.png' })
  @IsString()
  @IsUrl()
  completedTrendImageUrl: string;

  @ApiPropertyOptional({ example: 'playbook-templates/u1/2026-07-02/completed-trend/c.png' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  completedTrendImageKey?: string;

  @ApiPropertyOptional({ example: '关键是突破前压缩和回踩不破。' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @ApiPropertyOptional({ enum: PLAYBOOK_TEMPLATE_STATUS_VALUES, default: 'ACTIVE' })
  @IsOptional()
  @IsString()
  @IsIn(PLAYBOOK_TEMPLATE_STATUS_VALUES)
  status?: PlaybookTemplateStatus;
}
