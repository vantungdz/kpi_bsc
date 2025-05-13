import { Test, TestingModule } from '@nestjs/testing';
import { KpiValuesService } from './kpi-values.service';

describe('KpiValuesService', () => {
  let service: KpiValuesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KpiValuesService],
    }).compile();

    service = module.get<KpiValuesService>(KpiValuesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('approveKpiReview', () => {
    it('should transition status to the next level based on approver role', async () => {
      const mockKpiValue = { id: 1, status: 'PENDING_SECTION_APPROVAL' };
      jest.spyOn(service, 'findOne').mockResolvedValue(mockKpiValue as any);
      jest.spyOn(service['kpiValuesRepository'], 'save').mockResolvedValue({ ...mockKpiValue, status: 'PENDING_DEPT_APPROVAL' } as any);

      const result = await service.approveKpiReview(1, 'SECTION');
      expect(result.status).toBe('PENDING_DEPT_APPROVAL');
    });
  });

  describe('rejectKpiReview', () => {
    it('should transition status to rejected based on approver role', async () => {
      const mockKpiValue = { id: 1, status: 'PENDING_SECTION_APPROVAL' };
      jest.spyOn(service, 'findOne').mockResolvedValue(mockKpiValue as any);
      jest.spyOn(service['kpiValuesRepository'], 'save').mockResolvedValue({ ...mockKpiValue, status: 'REJECTED_BY_SECTION' } as any);

      const result = await service.rejectKpiReview(1, 'SECTION');
      expect(result.status).toBe('REJECTED_BY_SECTION');
    });
  });

  describe('resubmitKpiReview', () => {
    it('should transition status to RESUBMITTED if previously rejected', async () => {
      const mockKpiValue = { id: 1, status: 'REJECTED_BY_SECTION' };
      jest.spyOn(service, 'findOne').mockResolvedValue(mockKpiValue as any);
      jest.spyOn(service['kpiValuesRepository'], 'save').mockResolvedValue({ ...mockKpiValue, status: 'RESUBMITTED' } as any);

      const result = await service.resubmitKpiReview(1);
      expect(result.status).toBe('RESUBMITTED');
    });
  });
});
