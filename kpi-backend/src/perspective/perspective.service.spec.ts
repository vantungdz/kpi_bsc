import { Test, TestingModule } from '@nestjs/testing';
import { PerspectiveService } from './perspective.service';

describe('PerspectiveService', () => {
  let service: PerspectiveService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PerspectiveService],
    }).compile();

    service = module.get<PerspectiveService>(PerspectiveService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
