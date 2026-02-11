import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class TradeImageUploadUrlDto {
  @ApiProperty({ example: 'image.jpg' })
  @IsString()
  fileName: string;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  fileType: string;

  @ApiProperty({ example: '2026-02-06', description: 'YYYY-MM-DD' })
  @IsString()
  date: string;

  @ApiProperty({ example: 'trade-transaction-id', description: '绑定交易ID（必填）' })
  @IsString()
  transactionId: string;

  @ApiPropertyOptional({ example: 345678, description: '文件字节大小（可选）' })
  @IsOptional()
  @IsNumber()
  contentLength?: number;

  @ApiPropertyOptional({ example: 'trade', description: '来源标识，建议固定 trade' })
  @IsOptional()
  @IsString()
  source?: string;
}
