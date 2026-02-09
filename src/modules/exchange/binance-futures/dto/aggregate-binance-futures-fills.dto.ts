import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class AggregateBinanceFuturesFillsDto {
  @ApiProperty({
    description: '已同步成交记录 keys（tradeKey），例如 BTCUSDC#371484321',
    example: ['BTCUSDC#371484321'],
    isArray: true,
  })
  @IsArray()
  @IsString({ each: true })
  tradeKeys: string[];
}
