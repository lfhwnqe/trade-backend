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
}
