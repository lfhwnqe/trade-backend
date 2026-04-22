import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class RateFlashcardCardDto {
  @ApiProperty({
    description: '闪卡质量评分，复用管理页平均评分字段口径',
    minimum: 1,
    maximum: 10,
    example: 5,
  })
  @IsInt()
  @Min(1)
  @Max(10)
  score: number;
}
