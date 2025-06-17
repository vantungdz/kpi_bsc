import { IsNotEmpty, IsOptional, IsNumber, IsString, IsDateString, IsEnum, IsArray, ArrayNotEmpty, ArrayUnique } from 'class-validator';
import { PersonalGoalStatus } from '../entities/personal-goal.entity';

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
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(PersonalGoalStatus)
  status?: PersonalGoalStatus;
}

export class UpdatePersonalGoalDto extends CreatePersonalGoalDto {}
