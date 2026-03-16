import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsInt, IsString, Matches, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ReorderDictionaryItemOrderDto {
  @ApiProperty({ example: 'item-id-1' })
  @IsString()
  @MaxLength(64)
  itemId: string;

  @ApiProperty({ example: 100 })
  @IsInt()
  @Min(0)
  sortOrder: number;
}

export class ReorderDictionaryItemsDto {
  @ApiProperty({ example: 'trade_tag' })
  @IsString()
  @Matches(/^[a-z0-9_]+$/)
  @MaxLength(64)
  categoryCode: string;

  @ApiProperty({ type: [ReorderDictionaryItemOrderDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderDictionaryItemOrderDto)
  orders: ReorderDictionaryItemOrderDto[];
}
