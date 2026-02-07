import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, ArrayMaxSize } from 'class-validator';

export class ImportBinanceFuturesDto {
  @ApiProperty({
    description:
      '可选：指定要导入的合约标的列表（如 ["BTCUSDT","ETHUSDT"]）。如果不填，会尝试调用 Binance 的无 symbol 模式；若被 Binance 拒绝则需要提供 symbols。',
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  symbols?: string[];

  @ApiProperty({
    description:
      '导入范围：7d（默认）| 30d | 1y。注意：Binance 单次查询最大 7 天，我们会自动分段。',
    required: false,
    example: '7d',
  })
  @IsOptional()
  @IsString()
  range?: '7d' | '30d' | '1y';
}
