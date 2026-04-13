// src/kpi-values/dto/reject-value.dto.ts
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectValueDto {
  @ApiProperty({
    description: 'Reason for rejecting KPI value',
    example: 'Data is not accurate, need to verify the source.',
    required: true,
    maxLength: 500,
  })
  @IsNotEmpty({ message: 'Rejection reason cannot be empty' })
  @IsString()
  @MaxLength(500)
  reason: string;
}
