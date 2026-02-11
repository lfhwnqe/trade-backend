import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AdminCleanOrphanImagesDto {
  @ApiPropertyOptional({ description: '目标用户ID；不传默认当前用户' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: '仅预览不删除，默认 true', example: true })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @ApiPropertyOptional({ description: '扫描对象上限，默认 3000', example: 3000 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  objectScanLimit?: number;

  @ApiPropertyOptional({ description: '扫描交易上限，默认 3000', example: 3000 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  tradeScanLimit?: number;

  @ApiPropertyOptional({ description: '仅清理多少分钟前的对象，默认 60', example: 60 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  olderThanMinutes?: number;

  @ApiPropertyOptional({ description: '最多删除多少个对象，默认 500', example: 500 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  deleteLimit?: number;
}
