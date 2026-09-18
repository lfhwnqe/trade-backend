import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class ImageRecognitionFlashcardImageDto {
  @ApiProperty({ description: '图片访问 URL' })
  @IsString()
  @IsUrl()
  url: string;

  @ApiPropertyOptional({ description: 'S3 对象 key' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  key?: string;
}
