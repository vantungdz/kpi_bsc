// filter-kpi.dto.ts
import { IsOptional, IsString, IsInt, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer'; // Import Transform if needed for Int conversion

// --- CẬP NHẬT ENUM ---
// Đảm bảo enum này đồng bộ với enum trong kpi.entity.ts
// (Có thể import từ entity nếu bạn đặt enum ở đó)
export enum KpiStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  NEEDS_REVISION = 'NEEDS_REVISION',
}
// --- KẾT THÚC CẬP NHẬT ---

export class KpiFilterDto {
  @ApiProperty({
    example: 'Productivity',
    description: 'Tìm kiếm theo tên KPI', // Sửa mô tả
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    example: 1,
    description: 'Lọc theo ID phòng ban được gán', // Sửa mô tả
    required: false,
  })
  @Transform(({ value }) => parseInt(value, 10)) // Đảm bảo chuyển đổi thành số
  @IsInt()
  @IsOptional()
  departmentId?: number;

  @ApiProperty({
    example: 1,
    description: 'Lọc theo ID bộ phận được gán', // Sửa mô tả
    required: false,
  })
  @Transform(({ value }) => parseInt(value, 10)) // Đảm bảo chuyển đổi thành số
  @IsInt()
  @IsOptional()
  sectionId?: number;

  @ApiProperty({
    example: 1,
    description: 'Lọc theo ID nhóm được gán', // Sửa mô tả
    required: false,
  })
  @Transform(({ value }) => parseInt(value, 10)) // Đảm bảo chuyển đổi thành số
  @IsInt()
  @IsOptional()
  teamId?: number;

  @ApiProperty({
    example: 2,
    description: 'Lọc theo ID khía cạnh BSC', // Sửa mô tả
    required: false,
  })
  @Transform(({ value }) => parseInt(value, 10)) // Đảm bảo chuyển đổi thành số
  @IsInt()
  @IsOptional()
  perspectiveId?: number;

  @ApiProperty({
    example: 4,
    description: 'Lọc theo ID nhân viên được gán', // Sửa mô tả
    required: false,
  })
  @Transform(({ value }) => parseInt(value, 10)) // Đảm bảo chuyển đổi thành số
  @IsInt()
  @IsOptional()
  assignedToId?: number;

  @IsString()
  @IsOptional()
  assignedToName?: string; // Giữ lại nếu có logic lọc theo tên người được gán

  @IsString() // Nên dùng IsDateString nếu bạn muốn validate định dạng ngày cụ thể
  @IsOptional()
  startDate?: string;

  @IsString() // Nên dùng IsDateString
  @IsOptional()
  endDate?: string;

  @ApiProperty({ example: 1, description: 'Trang hiện tại', required: false })
  @Transform(({ value }) => parseInt(value, 10)) // Đảm bảo chuyển đổi thành số
  @IsInt()
  @IsOptional()
  page?: number = 1;

  @ApiProperty({
    example: 15,
    description: 'Số mục mỗi trang',
    required: false,
  })
  @Transform(({ value }) => parseInt(value, 10)) // Đảm bảo chuyển đổi thành số
  @IsInt()
  @IsOptional()
  limit?: number = 15;

  @ApiProperty({
    example: 'name',
    description: 'Sắp xếp theo trường (vd: name, created_at)', // Sửa mô tả
    required: false,
  })
  @IsString()
  @IsOptional()
  sortBy?: string; // --- CẬP NHẬT TRƯỜNG STATUS ---

  @ApiProperty({
    enum: KpiStatus, // Tham chiếu enum đã cập nhật
    example: KpiStatus.APPROVED, // Cập nhật ví dụ
    description: 'Lọc theo trạng thái quy trình KPI', // Cập nhật mô tả
    required: false,
  })
  @IsEnum(KpiStatus) // Xác thực với enum đã cập nhật
  @IsOptional()
  status?: KpiStatus; // Sử dụng kiểu enum đã cập nhật
  // --- KẾT THÚC CẬP NHẬT ---
  @ApiProperty({
    enum: ['ASC', 'DESC'], // Chỉ định rõ các giá trị hợp lệ
    example: 'DESC', // Cập nhật ví dụ
    description: 'Thứ tự sắp xếp (ASC hoặc DESC)', // Sửa mô tả
    required: false,
  })
  @IsEnum(['ASC', 'DESC']) // Xác thực với giá trị cho phép
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC';
}
