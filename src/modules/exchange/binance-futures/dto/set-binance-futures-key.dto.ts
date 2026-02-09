import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class SetBinanceFuturesKeyDto {
  @ApiProperty({ description: 'Binance API Key', example: 'xxxxxxxx' })
  @IsString()
  @MinLength(8)
  apiKey: string;

  @ApiProperty({ description: 'Binance API Secret', example: 'xxxxxxxx' })
  @IsString()
  @MinLength(8)
  apiSecret: string;

  @ApiPropertyOptional({
    description: '默认杠杆（用于 ROI 估算展示）',
    example: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(125)
  defaultLeverage?: number;
}
