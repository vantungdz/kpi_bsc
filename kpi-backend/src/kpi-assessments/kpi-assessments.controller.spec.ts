import { Test, TestingModule } from '@nestjs/testing';
import { KpiAssessmentsController } from './kpi-assessments.controller';

describe('KpiAssessmentsController', () => {
  let controller: KpiAssessmentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [KpiAssessmentsController],
    }).compile();

    controller = module.get<KpiAssessmentsController>(KpiAssessmentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
