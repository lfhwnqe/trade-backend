import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, Matches, MaxLength } from 'class-validator';

export class GetDictionaryOptionsBatchDto {
  @ApiProperty({ type: [String], example: ['trade_tag', 'mistake_type'] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Matches(/^[a-z0-9_]+$/, { each: true })
  @MaxLength(64, { each: true })
  categoryCodes: string[];
}
