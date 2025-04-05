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
});
