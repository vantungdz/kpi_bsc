import { Test, TestingModule } from '@nestjs/testing';
import { PerformanceEvaluationController } from './performance-evaluation.controller';

describe('PerformanceEvaluationController', () => {
  let controller: PerformanceEvaluationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PerformanceEvaluationController],
    }).compile();

    controller = module.get<PerformanceEvaluationController>(PerformanceEvaluationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
