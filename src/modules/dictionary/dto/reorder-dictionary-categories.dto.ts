import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsInt, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ReorderDictionaryCategoryOrderDto {
  @ApiProperty({ example: 'category-id-1' })
  @IsString()
  @MaxLength(64)
  categoryId: string;

  @ApiProperty({ example: 100 })
  @IsInt()
  @Min(0)
  sortOrder: number;
}

export class ReorderDictionaryCategoriesDto {
  @ApiProperty({ type: [ReorderDictionaryCategoryOrderDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderDictionaryCategoryOrderDto)
  orders: ReorderDictionaryCategoryOrderDto[];
}
