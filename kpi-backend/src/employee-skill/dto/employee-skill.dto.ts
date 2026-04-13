import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateEmployeeSkillDto {
  @IsNumber()
  employeeId: number;

  @IsNumber()
  competencyId: number;

  @IsNumber()
  level: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateEmployeeSkillDto {
  @IsOptional()
  @IsNumber()
  level?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
