import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsEnum,
  IsUrl,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum InputType {
  URL = 'url',
  FILE = 'file',
  STRING = 'string',
}

export class ParseOptionsDto {
  @ApiPropertyOptional({ description: '是否提取文本内容', default: true })
  @IsOptional()
  @IsBoolean()
  extractText?: boolean = true;

  @ApiPropertyOptional({ description: '是否提取样式信息', default: true })
  @IsOptional()
  @IsBoolean()
  extractStyles?: boolean = true;

  @ApiPropertyOptional({ description: '是否提取变换信息', default: true })
  @IsOptional()
  @IsBoolean()
  extractTransforms?: boolean = true;

  @ApiPropertyOptional({ description: '是否忽略隐藏元素', default: true })
  @IsOptional()
  @IsBoolean()
  ignoreHiddenElements?: boolean = true;

  @ApiPropertyOptional({
    description: '最大节点数量',
    default: 1000,
    minimum: 1,
    maximum: 10000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10000)
  maxNodes?: number = 1000;

  @ApiPropertyOptional({
    description: '解析超时时间(毫秒)',
    default: 30000,
    minimum: 1000,
    maximum: 300000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(300000)
  timeout?: number = 30000;

  @ApiPropertyOptional({ description: '是否验证结构', default: true })
  @IsOptional()
  @IsBoolean()
  validateStructure?: boolean = true;
}

export class SVGParseRequestDto {
  @ApiProperty({ description: 'SVG输入内容或URL' })
  @IsString()
  input: string;

  @ApiProperty({ description: '输入类型', enum: InputType })
  @IsEnum(InputType)
  inputType: InputType;

  @ApiPropertyOptional({ description: '解析选项' })
  @IsOptional()
  options?: ParseOptionsDto;
}

export class SVGParseFromUrlDto {
  @ApiProperty({ description: 'Whimsical脑图URL或SVG文件URL' })
  @IsUrl({}, { message: '请提供有效的URL' })
  url: string;

  @ApiPropertyOptional({ description: '解析选项' })
  @IsOptional()
  options?: ParseOptionsDto;
}

export class SVGParseFromStringDto {
  @ApiProperty({ description: 'SVG字符串内容' })
  @IsString()
  svgContent: string;

  @ApiPropertyOptional({ description: '解析选项' })
  @IsOptional()
  options?: ParseOptionsDto;
}

// 响应DTO
export class PointDto {
  @ApiProperty({ description: 'X坐标' })
  x: number;

  @ApiProperty({ description: 'Y坐标' })
  y: number;
}

export class SizeDto {
  @ApiProperty({ description: '宽度' })
  width: number;

  @ApiProperty({ description: '高度' })
  height: number;
}

export class GraphNodeDto {
  @ApiProperty({ description: '节点ID' })
  id: string;

  @ApiProperty({ description: '节点标签' })
  label: string;

  @ApiProperty({ description: '节点类型' })
  type: string;

  @ApiProperty({ description: '节点属性' })
  properties: Record<string, any>;

  @ApiProperty({ description: '节点位置' })
  position: PointDto;

  @ApiProperty({ description: '节点大小' })
  size: SizeDto;

  @ApiProperty({ description: '节点样式' })
  style: Record<string, any>;
}

export class GraphEdgeDto {
  @ApiProperty({ description: '边ID' })
  id: string;

  @ApiProperty({ description: '源节点ID' })
  source: string;

  @ApiProperty({ description: '目标节点ID' })
  target: string;

  @ApiPropertyOptional({ description: '边标签' })
  label?: string;

  @ApiProperty({ description: '边类型' })
  type: string;

  @ApiProperty({ description: '边属性' })
  properties: Record<string, any>;

  @ApiProperty({ description: '边样式' })
  style: Record<string, any>;
}

export class GraphDataDto {
  @ApiProperty({ description: '节点列表', type: [GraphNodeDto] })
  nodes: GraphNodeDto[];

  @ApiProperty({ description: '边列表', type: [GraphEdgeDto] })
  edges: GraphEdgeDto[];

  @ApiProperty({ description: '元数据' })
  metadata: {
    nodeCount: number;
    edgeCount: number;
    sourceFormat: string;
    createdAt: Date;
    version: string;
  };
}

export class ParseErrorDto {
  @ApiProperty({ description: '错误代码' })
  code: string;

  @ApiProperty({ description: '错误消息' })
  message: string;

  @ApiPropertyOptional({ description: '错误元素' })
  element?: string;

  @ApiPropertyOptional({ description: '错误行号' })
  line?: number;

  @ApiPropertyOptional({ description: '错误列号' })
  column?: number;

  @ApiProperty({
    description: '错误严重程度',
    enum: ['error', 'warning', 'info'],
  })
  severity: 'error' | 'warning' | 'info';
}

export class PerformanceMetricsDto {
  @ApiProperty({ description: '解析时间(毫秒)' })
  parseTime: number;

  @ApiProperty({ description: '内存使用(字节)' })
  memoryUsage: number;

  @ApiProperty({ description: '节点数量' })
  nodeCount: number;

  @ApiProperty({ description: '边数量' })
  edgeCount: number;

  @ApiProperty({ description: '元素总数' })
  elementCount: number;
}

export class SVGParseResponseDto {
  @ApiProperty({ description: '解析是否成功' })
  success: boolean;

  @ApiPropertyOptional({ description: '解析结果', type: GraphDataDto })
  data?: GraphDataDto;

  @ApiProperty({ description: '错误列表', type: [ParseErrorDto] })
  errors: ParseErrorDto[];

  @ApiProperty({ description: '性能指标', type: PerformanceMetricsDto })
  metrics: PerformanceMetricsDto;
}
