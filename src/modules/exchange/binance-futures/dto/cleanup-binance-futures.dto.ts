import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class CleanupBinanceFuturesDto {
  @ApiProperty({
    required: false,
    description: '是否同时删除已保存的 API Key 配置（默认 false）',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  includeKeys?: boolean;
}
