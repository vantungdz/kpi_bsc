import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectObjectiveEvaluationDto {
  @ApiProperty({ description: 'Reason for rejection', maxLength: 500 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  reason: string;
}
