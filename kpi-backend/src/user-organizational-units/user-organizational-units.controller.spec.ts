import { Test, TestingModule } from '@nestjs/testing';
import { UserOrganizationalUnitsController } from './user-organizational-units.controller';

describe('UserOrganizationalUnitsController', () => {
  let controller: UserOrganizationalUnitsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserOrganizationalUnitsController],
    }).compile();

    controller = module.get<UserOrganizationalUnitsController>(UserOrganizationalUnitsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
