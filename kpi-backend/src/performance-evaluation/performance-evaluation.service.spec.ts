import { Test, TestingModule } from '@nestjs/testing';
import { PerformanceEvaluationService } from './performance-evaluation.service';

describe('PerformanceEvaluationService', () => {
  let service: PerformanceEvaluationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PerformanceEvaluationService],
    }).compile();

    service = module.get<PerformanceEvaluationService>(PerformanceEvaluationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
