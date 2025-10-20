import {
  IsOptional,
  IsString,
  IsInt,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Expose } from 'class-transformer';

export enum KpiStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  NEEDS_REVISION = 'NEEDS_REVISION',
}

export class KpiFilterDto {
  @ApiProperty({
    example: 'Productivity',
    description: 'Search by KPI name',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    example: 1,
    description: 'Filter by assigned department ID',
    required: false,
  })
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return undefined;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? undefined : parsed;
  })
  @IsInt()
  @IsOptional()
  @Expose({ name: 'department_id' })
  departmentId?: number;

  @ApiProperty({
    example: 1,
    description: 'Filter by assigned section ID',
    required: false,
  })
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return undefined;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? undefined : parsed;
  })
  @IsInt()
  @IsOptional()
  @Expose({ name: 'section_id' })
  sectionId?: number;

  @ApiProperty({
    example: 1,
    description: 'Filter by assigned team ID',
    required: false,
  })
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return undefined;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? undefined : parsed;
  })
  @IsInt()
  @IsOptional()
  @Expose({ name: 'team_id' })
  teamId?: number;

  @ApiProperty({
    example: 2,
    description: 'Filter by BSC perspective ID',
    required: false,
  })
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return undefined;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? undefined : parsed;
  })
  @IsInt()
  @IsOptional()
  @Expose({ name: 'perspective_id' })
  perspectiveId?: number;

  @ApiProperty({
    example: 4,
    description: 'Filter by assigned employee ID',
    required: false,
  })
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return undefined;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? undefined : parsed;
  })
  @IsInt()
  @IsOptional()
  @Expose({ name: 'assigned_to_id' })
  assignedToId?: number;

  @IsString()
  @IsOptional()
  assignedToName?: string;

  @ApiProperty({
    example: 'company',
    description: 'Filter by KPI scope (company, department, section, employee)',
    required: false,
    enum: ['company', 'department', 'section', 'employee'],
  })
  @IsString()
  @IsOptional()
  @IsEnum(['company', 'department', 'section', 'employee'])
  scope?: string;

  @ApiProperty({
    example: '2024-01-01',
    description: 'Filter by start date',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  @Expose({ name: 'start_date' })
  startDate?: string;

  @ApiProperty({
    example: '2024-12-31',
    description: 'Filter by end date',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  @Expose({ name: 'end_date' })
  endDate?: string;

  @ApiProperty({ example: 1, description: 'Current page', required: false })
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return 1;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? 1 : parsed;
  })
  @IsInt()
  @IsOptional()
  page?: number = 1;

  @ApiProperty({
    example: 15,
    description: 'Items per page',
    required: false,
  })
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return 15;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? 15 : parsed;
  })
  @IsInt()
  @IsOptional()
  limit?: number = 15;

  @ApiProperty({
    example: 'name',
    description: 'Sort by field (e.g: name, created_at)',
    required: false,
  })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiProperty({
    enum: KpiStatus,
    example: KpiStatus.APPROVED,
    description: 'Filter by KPI process status',
    required: false,
  })
  @IsEnum(KpiStatus)
  @IsOptional()
  status?: KpiStatus;

  @ApiProperty({
    enum: ['ASC', 'DESC'],
    example: 'DESC',
    description: 'Sort order (ASC or DESC)',
    required: false,
  })
  @IsEnum(['ASC', 'DESC'])
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC';
}
