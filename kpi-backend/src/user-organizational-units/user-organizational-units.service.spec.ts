import { Test, TestingModule } from '@nestjs/testing';
import { UserOrganizationalUnitsService } from './user-organizational-units.service';

describe('UserOrganizationalUnitsService', () => {
  let service: UserOrganizationalUnitsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserOrganizationalUnitsService],
    }).compile();

    service = module.get<UserOrganizationalUnitsService>(UserOrganizationalUnitsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
