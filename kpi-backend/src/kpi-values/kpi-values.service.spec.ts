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
});
