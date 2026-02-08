import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    description: '邮箱（也可用作登录名）',
    example: 'name@company.com',
  })
  @IsEmail()
  email!: string;
}
