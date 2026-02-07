import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

export class ConvertBinanceFuturesFillsDto {
  @ApiProperty({
    description:
      '要转换为系统 Trade 的成交记录 tradeKey 列表（格式：SYMBOL#tradeId）',
    type: [String],
    example: ['BTCUSDT#123456'],
  })
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  tradeKeys: string[];
}
