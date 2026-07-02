import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength } from 'class-validator';
import { ALLOWED_IMAGE_TYPES } from '../../image/types/image.types';
import {
  PLAYBOOK_TEMPLATE_IMAGE_SCOPE_VALUES,
  PlaybookTemplateImageScope,
} from '../playbook-template.types';

export class GetPlaybookTemplateUploadUrlDto {
  @ApiProperty({ example: 'playbook-template.png' })
  @IsString()
  @MaxLength(200)
  fileName: string;

  @ApiProperty({ example: 'image/png', enum: ALLOWED_IMAGE_TYPES })
  @IsString()
  @IsIn(ALLOWED_IMAGE_TYPES)
  contentType: string;

  @ApiProperty({ example: 'analysis', enum: PLAYBOOK_TEMPLATE_IMAGE_SCOPE_VALUES })
  @IsString()
  @IsIn(PLAYBOOK_TEMPLATE_IMAGE_SCOPE_VALUES)
  scope: PlaybookTemplateImageScope;
}
