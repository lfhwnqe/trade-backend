import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ description: '旧密码', example: 'Old_password_123' })
  @IsString()
  @MinLength(6)
  oldPassword!: string;

  @ApiProperty({ description: '新密码', example: 'New_password_123' })
  @IsString()
  @MinLength(6)
  newPassword!: string;
}
