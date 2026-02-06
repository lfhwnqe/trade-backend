import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SetBinanceFuturesKeyDto {
  @ApiProperty({ description: 'Binance API Key', example: 'xxxxxxxx' })
  @IsString()
  @MinLength(8)
  apiKey: string;

  @ApiProperty({ description: 'Binance API Secret', example: 'xxxxxxxx' })
  @IsString()
  @MinLength(8)
  apiSecret: string;
}
