import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTemplateDto {
  @IsString()
  name: string;

  @IsString()
  typePerformance: string; // '1', '2', or '3'

  @IsEnum(['efficiency', 'qualitative'])
  type: string;

  @IsString()
  unit: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  target: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  weight: number;

  @IsEnum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'])
  frequency: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  perspective_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  formula_id?: number;

  @IsOptional()
  @IsString()
  description?: string;
}
