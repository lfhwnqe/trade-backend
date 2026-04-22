import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsIn, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export class ResolveFlashcardSimulationAttemptDto {
  @ApiProperty({ enum: ['SUCCESS', 'FAILURE'] })
  @IsIn(['SUCCESS', 'FAILURE'])
  result: 'SUCCESS' | 'FAILURE';

  @ApiPropertyOptional({ description: '失败原因；result=FAILURE 时必填' })
  @ValidateIf((o) => o.result === 'FAILURE')
  @IsString()
  @MaxLength(4000)
  failureReason?: string;

  @ApiPropertyOptional({ description: '主误判类型；result=FAILURE 时必填' })
  @ValidateIf((o) => o.result === 'FAILURE')
  @IsString()
  primaryMistakeCode?: string;

  @ApiPropertyOptional({ type: [String], description: '误判标签；result=FAILURE 时必填' })
  @ValidateIf((o) => o.result === 'FAILURE')
  @IsArray()
  @IsString({ each: true })
  mistakeCodes?: string[];

  @ApiPropertyOptional({ description: '纠正说明' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  correctionNote?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 10, default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  cardQualityScore?: number;
}
