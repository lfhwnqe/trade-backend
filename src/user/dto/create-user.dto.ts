import { IsEmail, IsNotEmpty, MinLength, Matches } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty({ message: '用户名不能为空' })
  @MinLength(3, { message: '用户名长度至少为3位' })
  @Matches(/^((?!@).)*$/, { message: '用户名不能是邮箱格式' }) // Regex to ensure username does not contain '@'
  username!: string;

  @IsNotEmpty({ message: '邮箱不能为空' })
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email!: string;

  @IsNotEmpty({ message: '密码不能为空' })
  @MinLength(8, { message: '密码长度至少为8位' })
  // 可以在这里添加更复杂的密码策略，例如包含大小写字母、数字和特殊字符
  password!: string;
}