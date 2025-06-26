import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MindMapParseRequestDto {
  @ApiProperty({ description: '思维导图内容' })
  @IsString()
  content: string;

  @ApiProperty({
    description: '思维导图格式',
    enum: ['freemind', 'opml', 'json', 'markdown'],
  })
  @IsString()
  format: string;
}

export class MindMapUploadDto {
  @ApiPropertyOptional({ description: '思维导图格式，如果不提供将自动检测' })
  @IsOptional()
  @IsString()
  format?: string;
}

export class MindMapNodeDto {
  @ApiProperty({ description: '节点ID' })
  id: string;

  @ApiProperty({ description: '节点文本' })
  text: string;

  @ApiProperty({ description: '节点层级' })
  level: number;

  @ApiPropertyOptional({ description: '父节点ID' })
  parentId?: string;

  @ApiPropertyOptional({ description: '节点属性' })
  attributes?: Record<string, any>;
}

export class MindMapLinkDto {
  @ApiProperty({ description: '源节点ID' })
  source: string;

  @ApiProperty({ description: '目标节点ID' })
  target: string;
}

export class MindMapMetadataDto {
  @ApiProperty({ description: '思维导图格式' })
  format: string;

  @ApiProperty({ description: '标题' })
  title: string;

  @ApiPropertyOptional({ description: '作者' })
  author?: string;

  @ApiPropertyOptional({ description: '创建时间' })
  created?: string;

  @ApiPropertyOptional({ description: '修改时间' })
  modified?: string;
}

export class MindMapDataDto {
  @ApiProperty({ description: '节点列表', type: [MindMapNodeDto] })
  nodes: MindMapNodeDto[];

  @ApiProperty({ description: '连接列表', type: [MindMapLinkDto] })
  links: MindMapLinkDto[];

  @ApiProperty({ description: '元数据', type: MindMapMetadataDto })
  metadata: MindMapMetadataDto;
}

export class MindMapParseResponseDto {
  @ApiProperty({ description: '解析是否成功' })
  success: boolean;

  @ApiPropertyOptional({ description: '解析结果', type: MindMapDataDto })
  data?: MindMapDataDto;

  @ApiPropertyOptional({ description: '错误消息' })
  error?: string;
}

export class GraphCreateResponseDto {
  @ApiProperty({ description: '操作消息' })
  message: string;

  @ApiProperty({ description: '图ID' })
  graphId: string;

  @ApiProperty({ description: '节点数量' })
  nodeCount: number;

  @ApiProperty({ description: '边数量' })
  edgeCount: number;
}

export class NodeSearchResultDto {
  @ApiProperty({ description: '图ID' })
  graphId: string;

  @ApiProperty({ description: '节点ID' })
  nodeId: string;

  @ApiProperty({ description: '节点文本' })
  text: string;
}

export class SubgraphNodeDto {
  @ApiProperty({ description: '节点ID' })
  id: string;

  @ApiProperty({ description: '节点文本' })
  text: string;

  @ApiProperty({ description: '节点层级' })
  level: number;

  @ApiPropertyOptional({ description: '父节点ID' })
  parentId?: string;
}
