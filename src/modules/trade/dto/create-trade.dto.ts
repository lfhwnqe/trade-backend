import { IsString, IsArray, IsNumber, IsOptional, IsIn, ArrayMaxSize, Min, Max, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

// 市场结构枚举
export enum MarketStructure {
  BALANCED = '平衡',
  IMBALANCED = '失衡',
  UNSEEN = '未见过'
}

// 入场方向枚举
export enum EntryDirection {
  LONG = '多',
  SHORT = '空'
}

// 图片资源接口
export class ImageResource {
  @ApiProperty({ description: 'AWS CloudFront 资源 ID/键值，用于删除资源', example: 'images/2023-05-23/user123/image1.jpg' })
  @IsString()
  key: string;
  
  @ApiProperty({ description: '图片完整 URL', example: 'https://example.com/images/image1.jpg' })
  @IsString()
  url: string;
}

export class CreateTradeDto {
  @ApiProperty({ description: '日期/时间段', example: '2023-05-23 09:30-16:00' })
  @IsString()
  dateTimeRange: string;

  @ApiProperty({ description: '市场结构判断', enum: MarketStructure, example: MarketStructure.BALANCED })
  @IsEnum(MarketStructure)
  marketStructure: MarketStructure;

  // signalType 字段已删除，不再需要

  @ApiProperty({ description: '价值区上沿价格', example: 150.5 })
  @IsNumber()
  @Type(() => Number)
  vah: number;

  @ApiProperty({ description: '价值区下沿价格', example: 145.2 })
  @IsNumber()
  @Type(() => Number)
  val: number;

  @ApiProperty({ description: '成交量中枛价位', example: 147.8 })
  @IsNumber()
  @Type(() => Number)
  poc: number;

  @ApiProperty({ description: '入场多空方向', enum: EntryDirection, example: EntryDirection.LONG })
  @IsEnum(EntryDirection)
  entryDirection: EntryDirection;

  @ApiProperty({ description: '入场价格', example: 146.5 })
  @IsNumber()
  @Type(() => Number)
  entry: number;

  @ApiProperty({ description: '止损价格', example: 145.0 })
  @IsNumber()
  @Type(() => Number)
  stopLoss: number;
  
  @ApiProperty({ description: '止盈目标价格', example: 149.5 })
  @IsNumber()
  @Type(() => Number)
  target: number;
  
  @ApiProperty({ description: '离场价格', example: 148.7 })
  @IsNumber()
  @Type(() => Number)
  exit: number;

  @ApiProperty({ description: '成交量分布图，多张图', type: [ImageResource] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageResource)
  volumeProfileImage: ImageResource[];

  @ApiProperty({ description: '假设路径 A/B/C，最多3张图', type: [ImageResource], maxItems: 3 })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageResource)
  @ArrayMaxSize(3)
  hypothesisPaths: ImageResource[];

  @ApiProperty({ description: '实际路径，多张图', type: [ImageResource] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageResource)
  actualPath: ImageResource[];

  @ApiProperty({ description: '盈亏百分比', example: 2.5 })
  @IsNumber()
  @Type(() => Number)
  profitLoss: number;

  @ApiProperty({ description: '风险回报比', example: '1:3' })
  @IsString()
  rr: string;

  @ApiProperty({ description: '分析结果', example: '市场在空头压力下回调，符合预期' })
  @IsString()
  analysisResult: string;

  @ApiProperty({ description: '执行思维评分', minimum: 1, maximum: 5, example: 4 })
  @IsNumber()
  @Min(1)
  @Max(5)
  executionMindsetScore: number;

  @ApiProperty({ description: '改进措施', example: '应该更早离场，减少回撤风险' })
  @IsString()
  improvement: string;
}