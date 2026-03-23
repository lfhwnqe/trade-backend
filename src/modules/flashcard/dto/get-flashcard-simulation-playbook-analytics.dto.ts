import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class GetFlashcardSimulationPlaybookAnalyticsDto {
  @ApiPropertyOptional({
    example: 30,
    minimum: 1,
    maximum: 200,
    description: '按最近多少条已闭环 simulation attempts 做聚合分析',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  recentWindow?: number;

  @ApiPropertyOptional({
    example: 5,
    minimum: 1,
    maximum: 50,
    description: '低于该已闭环样本数的剧本不进入 weakest 排行，但仍保留在 items 中',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  minResolved?: number;
}
