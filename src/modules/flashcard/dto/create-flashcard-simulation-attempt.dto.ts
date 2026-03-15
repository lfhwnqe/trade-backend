import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateFlashcardSimulationAttemptDto {
  @ApiProperty({ description: '题目 cardId' })
  @IsString()
  cardId: string;

  @ApiProperty({ description: '当前蒙层推进位置（0~1）', example: 0.43 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  revealProgress: number;

  @ApiProperty({ description: '入场线在图片高度中的百分比（0~1）', example: 0.42 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  entryLineYPercent: number;

  @ApiProperty({ description: '止损线在图片高度中的百分比（0~1）', example: 0.55 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  stopLossLineYPercent: number;

  @ApiProperty({ description: '止盈线在图片高度中的百分比（0~1）', example: 0.22 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  takeProfitLineYPercent: number;

  @ApiProperty({ description: '当前三条线对应的 RR 值', example: 2.4 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rrValue: number;

  @ApiProperty({ enum: ['LONG', 'SHORT'] })
  @IsIn(['LONG', 'SHORT'])
  entryDirection: 'LONG' | 'SHORT';

  @ApiProperty({ description: '入场原因' })
  @IsString()
  @MaxLength(4000)
  entryReason: string;

  @ApiPropertyOptional({ description: '若为 replay 模式，可记录来源历史 attemptId' })
  @IsOptional()
  @IsString()
  replaySourceAttemptId?: string;
}
