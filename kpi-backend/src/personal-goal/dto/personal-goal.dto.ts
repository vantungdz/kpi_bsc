import {
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsString,
  IsDateString,
  IsEnum,
  IsArray,
  ArrayNotEmpty,
  ArrayUnique,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PersonalGoalStatus } from '../entities/personal-goal.entity';

// Helper function to convert DD-MM-YYYY to YYYY-MM-DD
function convertDateFormat(value: string): string {
  if (!value) return value;

  // Check if it's already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  // Check if it's in DD-MM-YYYY format
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(value)) {
    const [day, month, year] = value.split('-');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // If it's already a valid ISO date string, return as is
  return value;
}

export class CreatePersonalGoalDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsNumber({}, { each: true })
  kpiIds?: number[];

  @IsOptional()
  @IsNumber()
  targetValue?: number;

  @IsOptional()
  @IsNumber()
  currentValue?: number;

  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => convertDateFormat(value))
  startDate?: string;

  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => convertDateFormat(value))
  endDate?: string;

  @IsOptional()
  @IsEnum(PersonalGoalStatus)
  status?: PersonalGoalStatus;
}

export class UpdatePersonalGoalDto extends CreatePersonalGoalDto {}
