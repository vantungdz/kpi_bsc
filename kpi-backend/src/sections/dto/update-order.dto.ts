import { IsArray, IsInt, IsPositive, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SectionOrderItem {
  @IsInt({ message: 'ID must be an integer' })
  @IsPositive({ message: 'ID must be a positive integer' })
  id: number;

  @IsInt({ message: 'Sort order must be an integer' })
  @IsPositive({ message: 'Sort order must be a positive integer' })
  sort_order: number;
}

export class UpdateSectionOrderDto {
  @IsArray({ message: 'Data must be an array' })
  @ValidateNested({ each: true })
  @Type(() => SectionOrderItem)
  sections: SectionOrderItem[];
}
