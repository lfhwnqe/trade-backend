import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

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
}
