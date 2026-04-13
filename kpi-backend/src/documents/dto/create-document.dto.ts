import { ApiProperty } from '@nestjs/swagger';

export class CreateDocumentDto {
  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty()
  filePath: string;

  @ApiProperty({ required: false, default: 'general' })
  type?: string;

  @ApiProperty({ required: false })
  createdById?: number;
}
