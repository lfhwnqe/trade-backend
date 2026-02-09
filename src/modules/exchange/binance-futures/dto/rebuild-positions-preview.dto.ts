import { ApiProperty } from '@nestjs/swagger';
import { IsArray } from 'class-validator';

export class RebuildPositionsPreviewDto {
  @ApiProperty({
    description:
      'Fills JSON 数组（可以直接粘贴“已同步成交记录”里的 item，或 Binance 原始成交对象）',
    type: 'array',
    example: [],
  })
  @IsArray()
  fills: any[];
}
