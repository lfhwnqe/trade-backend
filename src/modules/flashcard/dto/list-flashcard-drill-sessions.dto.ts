import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const SESSION_STATUS_VALUES = ['IN_PROGRESS', 'COMPLETED', 'ABANDONED'] as const;
type SessionStatus = (typeof SESSION_STATUS_VALUES)[number];

export class ListFlashcardDrillSessionsDto {
  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiPropertyOptional({ description: '分页游标（base64url）' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ enum: SESSION_STATUS_VALUES, description: '按会话状态过滤' })
  @IsOptional()
  @IsIn(SESSION_STATUS_VALUES)
  status?: SessionStatus;
}

