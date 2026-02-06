import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateApiTokenDto {
  @ApiProperty({
    description: 'Token 名称（便于自己识别，例如 claw / laptop / script）',
    required: false,
    example: 'claw',
    maxLength: 64,
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string;
}
