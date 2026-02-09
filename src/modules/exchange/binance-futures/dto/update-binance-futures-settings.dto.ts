import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateBinanceFuturesSettingsDto {
  @ApiPropertyOptional({
    description: '默认杠杆（用于收益率/ROI 估算展示）',
    example: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(125)
  defaultLeverage?: number;
}
