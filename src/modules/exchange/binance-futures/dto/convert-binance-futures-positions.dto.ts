import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

export class ConvertBinanceFuturesPositionsDto {
  @ApiProperty({
    description: '要转换为系统 Trade 的仓位 positionKey 列表',
    type: [String],
    example: ['BTCUSDT#SHORT#1700000000000'],
  })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  positionKeys: string[];
}
