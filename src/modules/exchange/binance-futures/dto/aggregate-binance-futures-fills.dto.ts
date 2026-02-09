import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class AggregateBinanceFuturesFillsDto {
  @ApiProperty({
    description: '已同步成交记录 keys（tradeKey），例如 BTCUSDC#371484321',
    example: ['BTCUSDC#371484321'],
    isArray: true,
  })
  @IsArray()
  @IsString({ each: true })
  tradeKeys: string[];

  @ApiPropertyOptional({ description: '用于 ROI 估算的杠杆', example: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(125)
  leverage?: number;
}
