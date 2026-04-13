import { Test, TestingModule } from '@nestjs/testing';
import { SectionsService } from './sections.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Section } from './entities/section.entity';
import { EmployeesService } from '../employees/employees.service';

describe('SectionsService', () => {
  let service: SectionsService;
  let sectionRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
  };
  let employeesService: {
    findOne: jest.Mock;
    updateEmployee: jest.Mock;
    assignManagementPermissions: jest.Mock;
  };

  beforeEach(async () => {
    sectionRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    employeesService = {
      findOne: jest.fn(),
      updateEmployee: jest.fn(),
      assignManagementPermissions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SectionsService,
        {
          provide: getRepositoryToken(Section),
          useValue: sectionRepository,
        },
        {
          provide: EmployeesService,
          useValue: employeesService,
        },
      ],
    }).compile();

    service = module.get<SectionsService>(SectionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('updates only the targeted section manager', async () => {
    sectionRepository.findOne
      .mockResolvedValueOnce({
        id: 1,
        name: 'Section 1.1',
        managerId: null,
      })
      .mockResolvedValueOnce(null);
    sectionRepository.save.mockImplementation(async (section) => section);
    employeesService.findOne.mockResolvedValue({
      id: 10,
      sectionId: null,
    });
    employeesService.assignManagementPermissions.mockResolvedValue({});

    const result = await service.update(1, { managerId: 10 });

    expect(sectionRepository.save).toHaveBeenCalledTimes(1);
    expect(sectionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        managerId: 10,
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 1,
        managerId: 10,
      }),
    );
  });
});
