import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class GetFlashcardDrillAnalyticsDto {
  @ApiPropertyOptional({
    example: 30,
    minimum: 1,
    maximum: 100,
    description: '按最近多少个已完成会话做趋势与错因聚合',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  recentWindow?: number;
}
