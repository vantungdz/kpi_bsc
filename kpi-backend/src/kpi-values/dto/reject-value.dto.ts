// src/kpi-values/dto/reject-value.dto.ts
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectValueDto {
  @ApiProperty({
    description: 'Lý do từ chối giá trị KPI',
    example: 'Số liệu chưa chính xác, cần kiểm tra lại nguồn.',
    required: true,
    maxLength: 500,
  })
  @IsNotEmpty({ message: 'Lý do từ chối không được để trống' })
  @IsString()
  @MaxLength(500)
  reason: string;
}
