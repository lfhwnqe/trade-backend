import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class RandomImageRecognitionFlashcardTrainingDto {
  @ApiPropertyOptional({ example: 20, default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  count: number = 20;

  @ApiPropertyOptional({ example: 'range_breakout', description: '剧本类型编码（来自 playbook_type）' })
  @IsOptional()
  @IsString()
  playbookType?: string;
}
