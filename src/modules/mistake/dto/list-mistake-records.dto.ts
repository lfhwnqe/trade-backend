import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, Min } from 'class-validator';
import {
  MISTAKE_DOMAIN_VALUES,
  MISTAKE_REVIEW_STATUS_VALUES,
  MISTAKE_SOURCE_TYPE_VALUES,
} from '../mistake.types';

export class ListMistakeRecordsDto {
  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  pageSize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ enum: MISTAKE_SOURCE_TYPE_VALUES })
  @IsOptional()
  @IsIn(MISTAKE_SOURCE_TYPE_VALUES)
  sourceType?: (typeof MISTAKE_SOURCE_TYPE_VALUES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  primaryMistakeCode?: string;

  @ApiPropertyOptional({ enum: MISTAKE_DOMAIN_VALUES })
  @IsOptional()
  @IsIn(MISTAKE_DOMAIN_VALUES)
  mistakeDomain?: (typeof MISTAKE_DOMAIN_VALUES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  playbookType?: string;

  @ApiPropertyOptional({ enum: MISTAKE_REVIEW_STATUS_VALUES })
  @IsOptional()
  @IsIn(MISTAKE_REVIEW_STATUS_VALUES)
  reviewStatus?: (typeof MISTAKE_REVIEW_STATUS_VALUES)[number];
}
