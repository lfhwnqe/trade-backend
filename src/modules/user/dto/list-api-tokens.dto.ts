import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListApiTokensDto {
  @ApiPropertyOptional({
    description: '每页数量（1-100），默认 20',
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: '分页游标（服务端返回的 nextCursor，base64url）',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}
