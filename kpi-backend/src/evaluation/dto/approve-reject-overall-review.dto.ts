import { ApiProperty } from '@nestjs/swagger';

export class ApproveRejectOverallReviewDto {
  @ApiProperty({ description: 'ID of the overall review' })
  overallReviewId: number;

  @ApiProperty({ description: 'Approval status (approve/reject)' })
  status: 'approve' | 'reject';

  @ApiProperty({ description: 'Optional comment', required: false })
  comment?: string;
}
