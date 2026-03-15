import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class ResolveFlashcardSimulationAttemptDto {
  @ApiProperty({ enum: ['SUCCESS', 'FAILURE'] })
  @IsIn(['SUCCESS', 'FAILURE'])
  result: 'SUCCESS' | 'FAILURE';

  @ApiPropertyOptional({ description: '失败原因；result=FAILURE 时必填' })
  @ValidateIf((o) => o.result === 'FAILURE')
  @IsString()
  @MaxLength(4000)
  failureReason?: string;

  @ApiPropertyOptional({ enum: [1, 2, 3, 4, 5], default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsIn([1, 2, 3, 4, 5])
  cardQualityScore?: 1 | 2 | 3 | 4 | 5;
}
