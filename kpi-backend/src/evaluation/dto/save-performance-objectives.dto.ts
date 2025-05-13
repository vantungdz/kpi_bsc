import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class SavePerformanceObjectivesDto {
  @IsNumber()
  employeeId: number;

  @IsString()
  @IsOptional()
  cycleId?: string;

  @IsArray()
  objectives: Array<{
    id: number;
    score: number;
    note?: string;
  }>;

  @IsArray()
  evaluations: Array<{
    objectiveId: number;
    score: number;
    note?: string;
  }>;
}
