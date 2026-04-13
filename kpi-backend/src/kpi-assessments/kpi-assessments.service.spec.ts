import { Test, TestingModule } from '@nestjs/testing';
import { KpiAssignmentsService } from './kpi-assessments.service';

describe('KpiAssessmentsService', () => {
  let service: KpiAssignmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KpiAssignmentsService],
    }).compile();

    service = module.get<KpiAssignmentsService>(KpiAssignmentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
