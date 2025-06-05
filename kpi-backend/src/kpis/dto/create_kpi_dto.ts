import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsArray,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { Expose, Type } from 'class-transformer';

// DTO for the Section
class SectionDTO {
  @IsNumber()
  id: number;

  @IsString()
  target: string;
}

// DTO for the Department
class DepartmentDTO {
  @IsNumber()
  id: number;

  @IsString()
  target: string;
}

// DTO for the Assignments
class AssignmentsDTO {
  @IsString()
  from: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionDTO)
  @Expose({ name: 'to_sections' })
  toSections: SectionDTO[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DepartmentDTO)
  @Expose({ name: 'to_departments' })
  toDepartments: DepartmentDTO[];

  @IsOptional()
  @IsNumber({})
  @Expose({ name: 'assigned_to_employee' })
  employeeId?: number;
}

export class CreateKpiDto {
  @IsString()
  name: string;

  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  unit: string;

  @Type(() => Number)
  @IsNumber()
  target: number;

  @Type(() => Number)
  @IsNumber()
  weight: number;

  @IsEnum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'])
  frequency: string;

  @IsOptional()
  @IsNumber({}, { each: true })
  @Expose({ name: 'department_id' })
  departmentId?: number[];

  @IsOptional()
  @IsNumber({}, { each: true })
  @Expose({ name: 'section_id' })
  sectionId?: number[];

  @IsOptional()
  @IsNumber()
  @Expose({ name: 'perspective_id' })
  perspectiveId?: number;

  @IsOptional()
  @IsDateString()
  @Expose({ name: 'start_date' })
  startDate?: string;

  @IsOptional()
  @IsDateString()
  @Expose({ name: 'end_date' })
  endDate?: string;

  @IsOptional()
  @IsString()
  parent?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AssignmentsDTO)
  assignments?: AssignmentsDTO; // Here we include the assignments object with sections and departments
}
