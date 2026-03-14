import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListFlashcardSimulationSessionsDto {
  @ApiPropertyOptional({ example: 20, default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @ApiPropertyOptional({ description: '分页游标，由上一次查询返回的 nextCursor 透传' })
  @IsOptional()
  cursor?: string;

  @ApiPropertyOptional({ enum: ['IN_PROGRESS', 'COMPLETED', 'ABANDONED'] })
  @IsOptional()
  @IsIn(['IN_PROGRESS', 'COMPLETED', 'ABANDONED'])
  status?: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
}
