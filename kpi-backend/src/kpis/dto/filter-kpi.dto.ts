import { IsOptional, IsString, IsInt, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

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
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @IsOptional()
  departmentId?: number;

  @ApiProperty({
    example: 1,
    description: 'Lọc theo ID bộ phận được gán',
    required: false,
  })
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @IsOptional()
  sectionId?: number;

  @ApiProperty({
    example: 1,
    description: 'Lọc theo ID nhóm được gán',
    required: false,
  })
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @IsOptional()
  teamId?: number;

  @ApiProperty({
    example: 2,
    description: 'Lọc theo ID khía cạnh BSC',
    required: false,
  })
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @IsOptional()
  perspectiveId?: number;

  @ApiProperty({
    example: 4,
    description: 'Lọc theo ID nhân viên được gán',
    required: false,
  })
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @IsOptional()
  assignedToId?: number;

  @IsString()
  @IsOptional()
  assignedToName?: string;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({ example: 1, description: 'Trang hiện tại', required: false })
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @IsOptional()
  page?: number = 1;

  @ApiProperty({
    example: 15,
    description: 'Số mục mỗi trang',
    required: false,
  })
  @Transform(({ value }) => parseInt(value, 10))
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
