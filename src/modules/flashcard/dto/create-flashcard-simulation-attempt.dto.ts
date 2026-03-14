import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateIf } from 'class-validator';

export class CreateFlashcardSimulationAttemptDto {
  @ApiProperty({ description: '题目 cardId' })
  @IsString()
  cardId: string;

  @ApiProperty({ description: '入场线在图片高度中的百分比（0~1）', example: 0.42 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  entryLineYPercent: number;

  @ApiProperty({ description: '止损线在图片高度中的百分比（0~1）', example: 0.55 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stopLossLineYPercent: number;

  @ApiProperty({ description: '止盈线在图片高度中的百分比（0~1）', example: 0.22 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
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

  @ApiProperty({ description: '盈亏比设置原因' })
  @IsString()
  @MaxLength(4000)
  rrReason: string;

  @ApiProperty({ enum: ['SUCCESS', 'FAILURE'] })
  @IsIn(['SUCCESS', 'FAILURE'])
  result: 'SUCCESS' | 'FAILURE';

  @ApiPropertyOptional({ description: '失败备注；result=FAILURE 时可填写' })
  @ValidateIf((o) => o.result === 'FAILURE' && o.failureNote !== undefined)
  @IsString()
  @MaxLength(4000)
  failureNote?: string;

  @ApiPropertyOptional({ enum: [1, 2, 3, 4, 5], default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsIn([1, 2, 3, 4, 5])
  cardQualityScore?: 1 | 2 | 3 | 4 | 5;
}
