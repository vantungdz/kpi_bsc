import { Test, TestingModule } from '@nestjs/testing';
import { KpiValuesController } from './kpi-values.controller';

describe('KpiValuesController', () => {
  let controller: KpiValuesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [KpiValuesController],
    }).compile();

    controller = module.get<KpiValuesController>(KpiValuesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('approveKpiReview', () => {
    it('should call service to approve KPI review', async () => {
      const mockKpiValue = { id: 1, status: 'PENDING_DEPT_APPROVAL' };
      jest.spyOn(controller['kpiValuesService'], 'approveKpiReview').mockResolvedValue(mockKpiValue as any);

      const result = await controller.approveKpiReview(1, 'DEPARTMENT');
      expect(result.status).toBe('PENDING_DEPT_APPROVAL');
    });
  });

  describe('rejectKpiReview', () => {
    it('should call service to reject KPI review', async () => {
      const mockKpiValue = { id: 1, status: 'REJECTED_BY_DEPT' };
      jest.spyOn(controller['kpiValuesService'], 'rejectKpiReview').mockResolvedValue(mockKpiValue as any);

      const result = await controller.rejectKpiReview(1, 'DEPARTMENT');
      expect(result.status).toBe('REJECTED_BY_DEPT');
    });
  });

  describe('resubmitKpiReview', () => {
    it('should call service to resubmit KPI review', async () => {
      const mockKpiValue = { id: 1, status: 'RESUBMITTED' };
      jest.spyOn(controller['kpiValuesService'], 'resubmitKpiReview').mockResolvedValue(mockKpiValue as any);

      const result = await controller.resubmitKpiReview(1);
      expect(result.status).toBe('RESUBMITTED');
    });
  });
});
