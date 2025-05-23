import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class LoginUserDto {
  @IsNotEmpty({ message: '邮箱不能为空' })
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email!: string;

  @IsNotEmpty({ message: '密码不能为空' })
  @MinLength(8, { message: '密码长度至少为8位' })
  password!: string;
}
