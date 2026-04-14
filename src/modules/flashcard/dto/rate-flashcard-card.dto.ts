import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class RateFlashcardCardDto {
  @ApiProperty({
    description: '闪卡质量评分，复用管理页平均评分字段口径',
    minimum: 1,
    maximum: 5,
    example: 4,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  score: number;
}
