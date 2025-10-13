import { IsOptional, IsString, IsInt, IsEnum } from 'class-validator';
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
    description: 'Tìm kiếm theo tên KPI',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    example: 1,
    description: 'Lọc theo ID phòng ban được gán',
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
    description: 'Lọc theo ID bộ phận được gán',
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
    description: 'Lọc theo ID nhóm được gán',
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
    description: 'Lọc theo ID khía cạnh BSC',
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
    description: 'Lọc theo ID nhân viên được gán',
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
    description:
      'Lọc theo phạm vi KPI (company, department, section, employee)',
    required: false,
    enum: ['company', 'department', 'section', 'employee'],
  })
  @IsString()
  @IsOptional()
  @IsEnum(['company', 'department', 'section', 'employee'])
  scope?: string;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({ example: 1, description: 'Trang hiện tại', required: false })
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
    description: 'Số mục mỗi trang',
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
    description: 'Sắp xếp theo trường (vd: name, created_at)',
    required: false,
  })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiProperty({
    enum: KpiStatus,
    example: KpiStatus.APPROVED,
    description: 'Lọc theo trạng thái quy trình KPI',
    required: false,
  })
  @IsEnum(KpiStatus)
  @IsOptional()
  status?: KpiStatus;

  @ApiProperty({
    enum: ['ASC', 'DESC'],
    example: 'DESC',
    description: 'Thứ tự sắp xếp (ASC hoặc DESC)',
    required: false,
  })
  @IsEnum(['ASC', 'DESC'])
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC';
}
