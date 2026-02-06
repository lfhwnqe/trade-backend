import { IsNotEmpty, MinLength, IsString } from 'class-validator';

export class LoginUserDto {
  @IsNotEmpty({ message: '账号不能为空' })
  @IsString({ message: '账号必须为字符串' })
  email!: string;

  @IsNotEmpty({ message: '密码不能为空' })
  @MinLength(8, { message: '密码长度至少为8位' })
  password!: string;
}
