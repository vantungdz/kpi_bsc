import { Test, TestingModule } from '@nestjs/testing';
import { EvaluationService } from './evaluation.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Employee } from '../entities/employee.entity';
import { Section } from '../entities/section.entity';
import { Department } from '../entities/department.entity';
import { KPIAssignment } from '../entities/kpi-assignment.entity';
import { KpiValue } from '../entities/kpi-value.entity';
import { KpiReview } from '../entities/kpi-review.entity';
import { OverallReview } from '../entities/overall-review.entity';
// import { PerformanceObjectiveEvaluation } from '../entities/performance-objective-evaluation.entity';
// import { PerformanceObjectiveEvaluationDetail } from '../entities/performance-objective-evaluation-detail.entity';
import { EntityManager } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('EvaluationService', () => {
  let service: EvaluationService;
  let employeeRepository: any;
  let assignmentRepository: any;
  let kpiValueRepository: any;
  let overallReviewRepository: any;

  beforeEach(async () => {
    employeeRepository = { find: jest.fn(), findOne: jest.fn() };
    assignmentRepository = { find: jest.fn() };
    kpiValueRepository = { find: jest.fn() };
    overallReviewRepository = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluationService,
        { provide: getRepositoryToken(Employee), useValue: employeeRepository },
        { provide: getRepositoryToken(Section), useValue: {} },
        { provide: getRepositoryToken(Department), useValue: {} },
        { provide: getRepositoryToken(KPIAssignment), useValue: assignmentRepository },
        { provide: getRepositoryToken(KpiValue), useValue: kpiValueRepository },
        { provide: getRepositoryToken(KpiReview), useValue: {} },
        { provide: getRepositoryToken(OverallReview), useValue: overallReviewRepository },
        { provide: EntityManager, useValue: {} },
        { provide: EventEmitter2, useValue: {} },
      ],
    }).compile();

    service = module.get<EvaluationService>(EvaluationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getKpisForReview', () => {
    it('should return empty if not allowed to review', async () => {
      jest.spyOn(service, 'getReviewableTargets').mockResolvedValue([]);
      await expect(
        service.getKpisForReview({ id: 1, role: 'employee' } as any, 2, 'employee', '2024-Q4')
      ).rejects.toThrow();
    });

    it('should return kpis with correct actualValue logic', async () => {
      jest.spyOn(service, 'getReviewableTargets').mockResolvedValue([
        { id: 10, name: 'Test Employee', type: 'employee' },
      ]);
      const startDate = new Date('2024-10-01');
      const endDate = new Date('2024-12-31');
      jest.spyOn<any, any>(service, 'getDateRangeFromCycleId').mockReturnValue({ startDate, endDate });
      assignmentRepository.find.mockResolvedValue([
        {
          id: 1,
          kpi: { id: 100, name: 'KPI 1', description: 'desc', unit: 'unit' },
          targetValue: 50,
          kpiValues: [
            { value: 10, status: 'APPROVED', timestamp: new Date('2024-11-01') },
            { value: 20, status: 'APPROVED', timestamp: new Date('2024-09-01') },
          ],
          reviews: [],
        },
        {
          id: 2,
          kpi: { id: 101, name: 'KPI 2', description: 'desc2', unit: 'unit2' },
          targetValue: 100,
          kpiValues: [
            { value: 30, status: 'APPROVED', timestamp: new Date('2024-08-01') },
          ],
          reviews: [],
        },
      ]);
      overallReviewRepository.findOne.mockResolvedValue(null);
      const result = await service.getKpisForReview(
        { id: 1, role: 'manager' } as any,
        10,
        'employee',
        '2024-Q4',
      );
      expect(result.kpisToReview.length).toBe(2);
      expect(result.kpisToReview[0].actualValue).toBe(10); // in cycle
      expect(result.kpisToReview[1].actualValue).toBe(30); // fallback to latest APPROVED
    });

    it('should set DEPARTMENT_REVIEW_PENDING if section reviews exist', async () => {
      jest.spyOn(service, 'getReviewableTargets').mockResolvedValue([
        { id: 10, name: 'Test Department', type: 'department' },
      ]);
      const startDate = new Date('2024-10-01');
      const endDate = new Date('2024-12-31');
      jest.spyOn<any, any>(service, 'getDateRangeFromCycleId').mockReturnValue({ startDate, endDate });
      assignmentRepository.find.mockResolvedValue([
        {
          id: 1,
          kpi: { id: 100, name: 'KPI 1', description: 'desc', unit: 'unit' },
          targetValue: 50,
          kpiValues: [],
          reviews: [
            {
              reviewedBy: { id: 2, role: { name: 'section' } },
              cycleId: '2024-Q4',
              managerComment: 'Section review comment',
              managerScore: 80,
            },
          ],
        },
      ]);
      overallReviewRepository.findOne.mockResolvedValue(null);

      const result = await service.getKpisForReview(
        { id: 1, role: 'manager' } as any,
        10,
        'department',
        '2024-Q4',
      );

      expect(result.existingOverallReview).not.toBeNull();
      expect(result.existingOverallReview!.status).toBe('DEPARTMENT_REVIEW_PENDING');
    });

    it('should retain DEPARTMENT_REVIEW_PENDING when department selects the same employee and cycle', async () => {
      jest.spyOn(service, 'getReviewableTargets').mockResolvedValue([
        { id: 10, name: 'Test Department', type: 'department' },
      ]);
      const startDate = new Date('2024-10-01');
      const endDate = new Date('2024-12-31');
      jest.spyOn<any, any>(service, 'getDateRangeFromCycleId').mockReturnValue({ startDate, endDate });
      assignmentRepository.find.mockResolvedValue([
        {
          id: 1,
          kpi: { id: 100, name: 'KPI 1', description: 'desc', unit: 'unit' },
          targetValue: 50,
          kpiValues: [],
          reviews: [
            {
              reviewedBy: { id: 2, role: { name: 'section' } },
              cycleId: '2024-Q4',
              managerComment: 'Section review comment',
              managerScore: 80,
            },
          ],
        },
      ]);
      overallReviewRepository.findOne.mockResolvedValue({
        overallComment: 'Existing comment',
        status: 'PENDING_REVIEW',
        employeeComment: null,
        employeeFeedbackDate: null,
      });

      const result = await service.getKpisForReview(
        { id: 1, role: 'manager' } as any,
        10,
        'department',
        '2024-Q4',
      );

      expect(result.existingOverallReview).not.toBeNull();
      expect(result.existingOverallReview!.status).toBe('DEPARTMENT_REVIEW_PENDING');
      console.log('Test result:', result.existingOverallReview);
    });
  });
});
