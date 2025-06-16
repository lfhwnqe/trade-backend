import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { DocumentType, DocumentStatus } from '../types/rag.types';
import { DocumentMetadataDto } from './create-document.dto';

export class UpdateDocumentDto {
  @ApiProperty({
    description: '文档标题',
    example: '更新后的以太坊交易策略分析',
    required: false,
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({
    description: '文档类型',
    enum: DocumentType,
    example: DocumentType.KNOWLEDGE,
    required: false,
  })
  @IsEnum(DocumentType)
  @IsOptional()
  documentType?: DocumentType;

  @ApiProperty({
    description: '文档状态',
    enum: DocumentStatus,
    example: DocumentStatus.COMPLETED,
    required: false,
  })
  @IsEnum(DocumentStatus)
  @IsOptional()
  status?: DocumentStatus;

  @ApiProperty({
    description: '文档元数据',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => DocumentMetadataDto)
  metadata?: DocumentMetadataDto;

  @ApiProperty({
    description: '是否标记为已访问',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  markAsAccessed?: boolean;
}
