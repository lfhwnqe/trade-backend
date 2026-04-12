import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString, MaxLength, ArrayMinSize } from 'class-validator';
import {
  MISTAKE_DOMAIN_VALUES,
  MISTAKE_REVIEW_STATUS_VALUES,
  MISTAKE_SOURCE_TYPE_VALUES,
} from '../mistake.types';

export class CreateMistakeRecordDto {
  @ApiProperty({ enum: MISTAKE_SOURCE_TYPE_VALUES })
  @IsIn(MISTAKE_SOURCE_TYPE_VALUES)
  sourceType: (typeof MISTAKE_SOURCE_TYPE_VALUES)[number];

  @ApiProperty()
  @IsString()
  sourceId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  simulationAttemptId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tradeFlashcardId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cardId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  playbookType?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagCodes?: string[];

  @ApiProperty()
  @IsString()
  primaryMistakeCode: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  mistakeCodes: string[];

  @ApiProperty({ enum: MISTAKE_DOMAIN_VALUES })
  @IsIn(MISTAKE_DOMAIN_VALUES)
  mistakeDomain: (typeof MISTAKE_DOMAIN_VALUES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  correctionNote?: string;

  @ApiPropertyOptional({ enum: MISTAKE_REVIEW_STATUS_VALUES, default: 'NEW' })
  @IsOptional()
  @IsIn(MISTAKE_REVIEW_STATUS_VALUES)
  reviewStatus?: (typeof MISTAKE_REVIEW_STATUS_VALUES)[number];
}
