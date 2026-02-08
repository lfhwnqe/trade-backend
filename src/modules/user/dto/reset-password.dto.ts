import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    description: '邮箱（也可用作登录名）',
    example: 'name@company.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: '邮箱收到的验证码', example: '123456' })
  @IsString()
  code!: string;

  @ApiProperty({ description: '新密码', example: 'New_password_123' })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
