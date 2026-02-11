import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsString } from 'class-validator';

export class ResolveTradeImagesDto {
  @ApiProperty({
    description: '图片引用列表（可混合 legacy 公链 URL 与私有 key）',
    type: [String],
    example: [
      'https://legacy-public.example.com/a.jpg',
      'images/user-123/2026-02-11/1234-a.jpg',
    ],
  })
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  refs: string[];

  @ApiProperty({
    description: '可选：交易ID（用于前端调用时附带上下文）',
    required: false,
    example: 'transaction-id',
  })
  @IsOptional()
  @IsString()
  transactionId?: string;
}
