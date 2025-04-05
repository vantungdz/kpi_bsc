import { Test, TestingModule } from '@nestjs/testing';
import { PerspectiveController } from './perspective.controller';

describe('PerspectiveController', () => {
  let controller: PerspectiveController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PerspectiveController],
    }).compile();

    controller = module.get<PerspectiveController>(PerspectiveController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
