import {
  IsOptional,
  IsNumber,
  Min,
  IsString,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DateTimeRangeDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}

export class TradeQueryDto {
  @ApiPropertyOptional({ description: '页码', example: 1, default: 1 })
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ description: 'limit（兼容字段）', example: 20 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ description: '每页数量', example: 20, default: 20 })
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  pageSize: number = 20;

  @ApiPropertyOptional({ description: '交易类型（兼容字段）', example: '模拟交易' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: '交易分级', example: '高' })
  @IsOptional()
  @IsString()
  grade?: string;

  @ApiPropertyOptional({ description: '市场结构', example: '震荡' })
  @IsOptional()
  @IsString()
  marketStructure?: string;

  @ApiPropertyOptional({ description: '入场方向', example: '多' })
  @IsOptional()
  @IsString()
  entryDirection?: string;

  @ApiPropertyOptional({ description: '交易状态', example: '已离场' })
  @IsOptional()
  @IsString()
  tradeStatus?: string;

  @ApiPropertyOptional({ description: '交易结果', example: 'PROFIT' })
  @IsOptional()
  @IsString()
  tradeResult?: string;

  @ApiPropertyOptional({ description: '交易类型', example: '模拟交易' })
  @IsOptional()
  @IsString()
  tradeType?: string;

  @ApiPropertyOptional({
    description:
      '分析周期筛选（支持：15分钟/30分钟/1小时/4小时/1天，或自定义）',
    example: '1小时',
  })
  @IsOptional()
  @IsString()
  analysisPeriod?: string;

  @ApiPropertyOptional({ description: '开始日期', example: '2025-01-01' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: '结束日期', example: '2025-05-29' })
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiPropertyOptional({
    description: '时间范围对象',
    type: DateTimeRangeDto,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => DateTimeRangeDto)
  dateTimeRange?: DateTimeRangeDto;
}
