import { IsOptional, IsString, IsInt, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum KpiStatus {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
}

export class KpiFilterDto {
  @ApiProperty({
    example: 'Productivity',
    description: 'Tìm kiếm theo tên',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    example: 1,
    description: 'Lọc theo phòng ban',
    required: false,
  })
  @IsInt()
  @IsOptional()
  departmentId?: number;

  @ApiProperty({ example: 1, description: 'Lọc theo bộ phận', required: false })
  @IsInt()
  @IsOptional()
  sectionId?: number;

  @ApiProperty({ example: 1, description: 'Lọc theo nhóm', required: false })
  @IsInt()
  @IsOptional()
  teamId?: number;

  @ApiProperty({
    example: 2,
    description: 'Lọc theo khía cạnh BSC',
    required: false,
  })
  @IsInt()
  @IsOptional()
  perspectiveId?: number;

  @ApiProperty({
    example: 4,
    description: 'Lọc theo người được giao',
    required: false,
  })
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
  @IsInt()
  @IsOptional()
  page?: number = 1;

  @ApiProperty({
    example: 15,
    description: 'Số mục mỗi trang',
    required: false,
  })
  @IsInt()
  @IsOptional()
  limit?: number = 15;

  @ApiProperty({
    example: 'name',
    description: 'Sắp xếp theo trường',
    required: false,
  })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiProperty({
    enum: KpiStatus,
    example: 'Active',
    description: 'Trạng thái KPI',
    required: false,
  })
  @IsEnum(KpiStatus)
  @IsOptional()
  status?: KpiStatus;

  @ApiProperty({
    example: 'ASC',
    description: 'Thứ tự sắp xếp',
    required: false,
  })
  @IsString()
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC';
}
