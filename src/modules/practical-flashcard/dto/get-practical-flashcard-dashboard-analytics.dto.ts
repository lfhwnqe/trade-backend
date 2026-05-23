import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GetPracticalFlashcardDashboardAnalyticsDto {
  @ApiPropertyOptional({ description: 'ISO datetime lower bound by resolvedAt' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO datetime upper bound by resolvedAt' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  playbookType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  symbolPairInfo?: string;
}
