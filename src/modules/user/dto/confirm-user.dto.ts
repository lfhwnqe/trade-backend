import { IsEmail, IsString, Length } from 'class-validator';

export class ConfirmUserDto {
  @IsString()
  @Length(3, 64)
  username: string; // 兼容用邮箱作用户名场景

  @IsString()
  @Length(4, 10)
  code: string;
}