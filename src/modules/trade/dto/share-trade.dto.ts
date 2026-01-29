import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateShareableDto {
  @ApiProperty({
    description: '是否可分享',
    example: true,
  })
  @IsBoolean()
  isShareable: boolean;
}
