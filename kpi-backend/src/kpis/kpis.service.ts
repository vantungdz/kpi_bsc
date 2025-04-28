import { plainToInstance } from 'class-transformer';
import { Department } from 'src/entities/department.entity';
import { KPIAssignment } from 'src/entities/kpi-assignment.entity';
import { Kpi } from 'src/entities/kpi.entity';
import { Section } from 'src/entities/section.entity';
import { Team } from 'src/entities/team.entity';
import { Employee } from 'src/entities/employee.entity';
import { KpiValue } from 'src/entities/kpi-value.entity';
import { Perspective } from 'src/entities/perspective.entity';
import { Brackets, IsNull, Not, Repository } from 'typeorm';
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateKpiDto } from './dto/create_kpi_dto';
import { KpiFilterDto } from './dto/filter-kpi.dto';

@Injectable()
export class KpisService {
  constructor(
    @InjectRepository(Kpi)
    private readonly kpisRepository: Repository<Kpi>,
    @InjectRepository(KPIAssignment)
    private readonly kpiAssignmentRepository: Repository<KPIAssignment>,
  ) {}

  async getKpisByEmployeeId(employeeId: number): Promise<Kpi[]> {
    return this.kpisRepository
      .createQueryBuilder('kpi')
      .leftJoinAndSelect('kpi.assignments', 'assignment')

      .leftJoinAndSelect('assignment.employee', 'employee')
      .leftJoinAndSelect('assignment.section', 'section')
      .leftJoinAndSelect('assignment.department', 'department')
      .leftJoinAndSelect('assignment.team', 'team')

      .leftJoinAndSelect('section.department', 'departmentOfSection')
      .leftJoinAndSelect('kpi.perspective', 'perspective')
      .leftJoinAndSelect('assignment.kpiValues', 'kpiValue')
      .where('kpi.deleted_at IS NULL')
      .andWhere('assignment.deleted_at IS NULL')
      .andWhere('assignment.assigned_to_employee = :id', { id: employeeId })
      .getMany();
  }

  async findAll(filterDto: KpiFilterDto): Promise<{
    data: Kpi[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
    };
  }> {
    const { page = 1, limit = 15 } = filterDto;

    const query = this.kpisRepository
      .createQueryBuilder('kpi')
      .leftJoinAndSelect('kpi.assignments', 'assignment')

      .leftJoinAndSelect('assignment.department', 'department')
      .leftJoinAndSelect('assignment.section', 'section')
      .leftJoinAndSelect('assignment.team', 'team')
      .leftJoinAndSelect('assignment.employee', 'employee')
      .leftJoinAndSelect('section.department', 'departmentOfSection')
      .leftJoinAndSelect('kpi.perspective', 'perspective')
      .leftJoinAndSelect('assignment.kpiValues', 'kpiValue')
      .where('kpi.deleted_at IS NULL');

    query.andWhere('assignment.deleted_at IS NULL');

    if (filterDto.name) {
      query.andWhere('kpi.name ILIKE :name', {
        name: `%${filterDto.name}%`,
      });
    }

    if (filterDto.perspectiveId) {
      query.andWhere('kpi.perspective_id = :perspectiveId', {
        perspectiveId: filterDto.perspectiveId,
      });
    }

    if (filterDto.departmentId) {
      query.andWhere('assignment.assigned_to_department = :departmentId', {
        departmentId: filterDto.departmentId,
      });
    }

    if (filterDto.sectionId) {
      query.andWhere('assignment.assigned_to_section = :sectionId', {
        sectionId: filterDto.sectionId,
      });
    }

    if (filterDto.teamId) {
      query.andWhere('assignment.assigned_to_team = :teamId', {
        teamId: filterDto.teamId,
      });
    }

    if (filterDto.assignedToId) {
      query.andWhere('assignment.assigned_to_employee = :assignedToId', {
        assignedToId: filterDto.assignedToId,
      });
    }

    if (filterDto.status) {
      query.andWhere('kpi.status = :status', {
        status: filterDto.status,
      });
    }

    if (filterDto.startDate) {
      query.andWhere('kpi.start_date >= :startDate', {
        startDate: filterDto.startDate,
      });
    }

    if (filterDto.endDate) {
      query.andWhere('kpi.end_date <= :endDate', {
        endDate: filterDto.endDate,
      });
    }

    query.distinct(true);

    const validSortColumns = ['name', 'created_at'];
    const sortBy = validSortColumns.includes(filterDto.sortBy ?? '')
      ? filterDto.sortBy!
      : 'created_at';
    const sortOrder = filterDto.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    query.orderBy(`kpi.${sortBy}`, sortOrder);

    const [data, totalItems] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const dataWithActualValue = data.map((kpi) => {
      const activeAssignments = kpi.assignments.filter(
        (assignment) =>
          assignment.deleted_at === null || assignment.deleted_at === undefined,
      );
      const allValues = activeAssignments
        .flatMap((assignment) => assignment.kpiValues)
        .map((value) => Number(value.value) || 0);

      const actual_value =
        kpi.calculation_type === 'sum'
          ? allValues.reduce((sum, val) => sum + val, 0)
          : allValues.length > 0
            ? allValues.reduce((sum, val) => sum + val, 0) / allValues.length
            : 0;

      return { ...kpi, actual_value };
    });

    const pagination = {
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit),
      totalItems,
      itemsPerPage: limit,
    };

    return { data: dataWithActualValue, pagination };
  }

  async getDepartmentKpis(
    departmentId: number,
    filterDto: KpiFilterDto,
  ): Promise<{
    data: Kpi[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
    };
  }> {
    const { page = 1, limit = 15 } = filterDto;

    const query = this.kpisRepository
      .createQueryBuilder('kpi')
      .leftJoinAndSelect('kpi.assignments', 'assignment')

      .leftJoinAndSelect('assignment.section', 'section')
      .leftJoinAndSelect('assignment.team', 'team')
      .leftJoinAndSelect('assignment.employee', 'employee')
      .leftJoinAndSelect('kpi.perspective', 'perspective')
      .leftJoinAndSelect('assignment.kpiValues', 'kpiValue')
      .leftJoinAndSelect('section.department', 'departmentOfSection')
      .where('kpi.deleted_at IS NULL')
      .andWhere('assignment.deleted_at IS NULL')
      .andWhere(
        new Brackets((qb) => {
          qb.where(
            'kpi.created_by_type = :createdType AND kpi.created_by = :departmentIdFromPath',
            {
              createdType: 'department',
              departmentIdFromPath: departmentId,
            },
          ).orWhere(
            'assignment.assigned_to_department = :departmentIdFromPath',
            {
              departmentIdFromPath: departmentId,
            },
          );
        }),
      );

    if (filterDto.name) {
      query.andWhere('kpi.name ILIKE :name', {
        name: `%${filterDto.name}%`,
      });
    }

    if (filterDto.perspectiveId) {
      query.andWhere('kpi.perspective_id = :perspectiveId', {
        perspectiveId: filterDto.perspectiveId,
      });
    }

    if (filterDto.sectionId) {
      query.andWhere('assignment.assigned_to_section = :sectionId', {
        sectionId: filterDto.sectionId,
      });
    }

    if (filterDto.teamId) {
      query.andWhere('assignment.assigned_to_team = :teamId', {
        teamId: filterDto.teamId,
      });
    }

    if (filterDto.assignedToId) {
      query.andWhere('assignment.assigned_to_employee = :assignedToId', {
        assignedToId: filterDto.assignedToId,
      });
    }

    if (filterDto.status) {
      query.andWhere('kpi.status = :status', {
        status: filterDto.status,
      });
    }

    if (filterDto.startDate) {
      query.andWhere('kpi.start_date >= :startDate', {
        startDate: filterDto.startDate,
      });
    }

    if (filterDto.endDate) {
      query.andWhere('kpi.end_date <= :endDate', {
        endDate: filterDto.endDate,
      });
    }

    query.distinct(true);

    const validSortColumns = ['name', 'created_at'];
    const sortBy = validSortColumns.includes(filterDto.sortBy ?? '')
      ? filterDto.sortBy!
      : 'created_at';
    const sortOrder = filterDto.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    query.orderBy(`kpi.${sortBy}`, sortOrder);

    const [data, totalItems] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const dataWithActualValue = data.map((kpi) => {
      const activeAssignments = kpi.assignments.filter(
        (assignment) =>
          assignment.deleted_at === null || assignment.deleted_at === undefined,
      );
      const allValues = activeAssignments
        .flatMap((assignment) => assignment.kpiValues)
        .map((value) => Number(value.value) || 0);

      const actual_value =
        kpi.calculation_type === 'sum'
          ? allValues.reduce((sum, val) => sum + val, 0)
          : allValues.length > 0
            ? allValues.reduce((sum, val) => sum + val, 0) / allValues.length
            : 0;

      return { ...kpi, actual_value };
    });

    const pagination = {
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit),
      totalItems,
      itemsPerPage: limit,
    };

    return { data: dataWithActualValue, pagination };
  }

  async getAllKpiAssignedToDepartments(): Promise<Kpi[]> {
    return this.kpisRepository
      .createQueryBuilder('kpi')
      .leftJoinAndSelect('kpi.perspective', 'perspective')
      .leftJoinAndSelect('kpi.assignments', 'assignment')

      .leftJoinAndSelect('assignment.department', 'department')
      .leftJoinAndSelect('assignment.employee', 'employee')
      .leftJoinAndSelect('assignment.section', 'section')
      .leftJoinAndSelect('assignment.team', 'team')
      .leftJoinAndSelect('assignment.kpiValues', 'kpiValues')
      .leftJoinAndSelect('section.department', 'departmentOfSection')
      .where('assignment.assigned_to_department IS NOT NULL')
      .andWhere('assignment.deleted_at IS NULL')
      .andWhere('kpi.deleted_at IS NULL')
      .getMany();
  }

  async getAllKpiAssignedToSections(): Promise<Kpi[]> {
    return this.kpisRepository
      .createQueryBuilder('kpi')
      .leftJoinAndSelect('kpi.perspective', 'perspective')
      .leftJoinAndSelect('kpi.assignments', 'assignment')

      .leftJoinAndSelect('assignment.section', 'section')
      .leftJoinAndSelect('assignment.employee', 'employee')
      .leftJoinAndSelect('assignment.department', 'department')
      .leftJoinAndSelect('assignment.team', 'team')
      .leftJoinAndSelect('assignment.kpiValues', 'kpiValues')
      .leftJoinAndSelect('section.department', 'departmentOfSection')
      .where('assignment.assigned_to_section IS NOT NULL')
      .andWhere('assignment.deleted_at IS NULL')
      .andWhere('kpi.deleted_at IS NULL')
      .getMany();
  }

  async getSectionKpis(
    sectionIdParam: number | string,
    filterDto: KpiFilterDto,
  ): Promise<{
    data: (Kpi & { actual_value?: number })[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
    };
  }> {
    const sectionId = Number(sectionIdParam);

    const { page = 1, limit = 15 } = filterDto;

    const query = this.kpisRepository
      .createQueryBuilder('kpi')
      .leftJoinAndSelect('kpi.assignments', 'assignment')

      .leftJoinAndSelect('assignment.department', 'department')
      .leftJoinAndSelect('assignment.section', 'section')
      .leftJoinAndSelect('assignment.team', 'team')
      .leftJoinAndSelect('assignment.employee', 'employee')
      .leftJoinAndSelect('section.department', 'departmentOfSection')
      .leftJoinAndSelect('kpi.perspective', 'perspective')
      .leftJoinAndSelect('assignment.kpiValues', 'kpiValue')
      .where('kpi.deleted_at IS NULL')
      .andWhere('assignment.deleted_at IS NULL');

    if (sectionId === 0) {
      if (filterDto.departmentId) {
        const departmentAllFilterSql = `(kpi.created_by_type = :createdTypeDept AND kpi.created_by = :departmentIdFromFilter) OR (assignment.assigned_to_department = :departmentIdFromFilter) OR (assignment.assigned_to_section IS NOT NULL AND departmentOfSection.id = :departmentIdFromFilter)`;

        query.andWhere(departmentAllFilterSql, {
          createdTypeDept: 'department',
          departmentIdFromFilter: filterDto.departmentId,
        });
      } else {
        query.andWhere('assignment.assigned_to_section IS NOT NULL');
      }
    } else {
      query.andWhere(
        new Brackets((qb) => {
          qb.where(
            '(kpi.created_by_type = :createdTypeSection AND kpi.created_by = :sectionIdFromPath)',
            { createdTypeSection: 'section', sectionIdFromPath: sectionId },
          );
          qb.orWhere('assignment.assigned_to_section = :sectionIdFromPath', {
            sectionIdFromPath: sectionId,
          });
        }),
      );
    }

    if (filterDto.name) {
      query.andWhere('kpi.name ILIKE :name', { name: `%${filterDto.name}%` });
    }
    if (filterDto.perspectiveId) {
      query.andWhere('kpi.perspective_id = :perspectiveId', {
        perspectiveId: filterDto.perspectiveId,
      });
    }
    if (filterDto.teamId) {
      query.andWhere('assignment.assigned_to_team = :teamId', {
        teamId: filterDto.teamId,
      });
    }
    if (filterDto.status) {
      query.andWhere('kpi.status = :status', { status: filterDto.status });
    }
    if (filterDto.startDate) {
      query.andWhere('kpi.start_date >= :startDate', {
        startDate: filterDto.startDate,
      });
    }
    if (filterDto.endDate) {
      query.andWhere('kpi.end_date <= :endDate', {
        endDate: filterDto.endDate,
      });
    }

    query.distinct(true);

    const validSortColumns = ['name', 'created_at'];
    const sortBy = validSortColumns.includes(filterDto.sortBy ?? '')
      ? filterDto.sortBy!
      : 'created_at';
    const sortOrder = filterDto.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    query.orderBy(`kpi.${sortBy}`, sortOrder);

    const [data, totalItems] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const dataWithActualValue = data.map((kpi) => {
      const activeAssignments = kpi.assignments.filter(
        (assignment) =>
          assignment.deleted_at === null || assignment.deleted_at === undefined,
      );

      const allValues = activeAssignments
        .flatMap((assignment) => assignment.kpiValues)
        .map((value) => Number(value.value) || 0);

      const actual_value =
        kpi.calculation_type === 'sum'
          ? allValues.reduce((sum, val) => sum + val, 0)
          : allValues.length > 0
            ? allValues.reduce((sum, val) => sum + val, 0) / allValues.length
            : 0;

      return { ...kpi, actual_value };
    });

    const pagination = {
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit),
      totalItems,
      itemsPerPage: limit,
    };

    return { data: dataWithActualValue, pagination: pagination };
  }

  async getEmployeeKpis(
    employeeId: number,
    filterDto: KpiFilterDto,
  ): Promise<{
    data: Kpi[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
    };
  }> {
    const { page = 1, limit = 15 } = filterDto;

    const query = this.kpisRepository
      .createQueryBuilder('kpi')
      .leftJoinAndSelect('kpi.assignments', 'assignment')
      .leftJoinAndSelect('assignment.employee', 'employee')
      .leftJoinAndSelect('kpi.perspective', 'perspective')
      .leftJoinAndSelect('assignment.kpiValues', 'kpiValue')
      .andWhere('assignment.assigned_to_employee = :employeeId', {
        employeeId,
      });

    if (filterDto.name) {
      query.andWhere('kpi.name ILIKE :name', {
        name: `%${filterDto.name}%`,
      });
    }

    if (filterDto.perspectiveId) {
      query.andWhere('kpi.perspective_id = :perspectiveId', {
        perspectiveId: filterDto.perspectiveId,
      });
    }

    if (filterDto.status) {
      query.andWhere('kpi.status = :status', {
        status: filterDto.status,
      });
    }

    if (filterDto.startDate) {
      query.andWhere('kpi.start_date >= :startDate', {
        startDate: filterDto.startDate,
      });
    }

    if (filterDto.endDate) {
      query.andWhere('kpi.end_date <= :endDate', {
        endDate: filterDto.endDate,
      });
    }

    const validSortColumns = ['name', 'created_at'];
    const sortBy = validSortColumns.includes(filterDto.sortBy ?? '')
      ? filterDto.sortBy!
      : 'created_at';
    const sortOrder = filterDto.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    query.orderBy(`kpi.${sortBy}`, sortOrder);

    const [data, totalItems] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const pagination = {
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit),
      totalItems,
      itemsPerPage: limit,
    };

    return { data, pagination };
  }

  async findOne(id: number): Promise<Kpi> {
    const value = await this.kpisRepository.findOne({
      where: { id },
      relations: ['assignments', 'perspective'],
    });

    if (!value) {
      throw new NotFoundException(`KPI with ID "${id}" not found`);
    }
    return value;
  }

  async getKpiAssignments(kpiId: number): Promise<KPIAssignment[]> {
    const assignments = await this.kpiAssignmentRepository.find({
      where: { kpi_id: kpiId, deleted_at: IsNull() },
      withDeleted: true,
      relations: [
        'kpi',
        'department',
        'section',
        'team',
        'employee',
        'kpiValues',
      ],
    });

    return assignments;
  }

  async create(createKpiDto: CreateKpiDto): Promise<Kpi> {
    return await this.kpisRepository.manager.transaction(
      async (manager): Promise<Kpi> => {
        try {
          const dto = plainToInstance(CreateKpiDto, createKpiDto);
          const { assignments, id, ...kpiData } = dto as any;

          const createdByType = assignments?.from || 'company';
          const authenticatedUserId = 1;
          let creatorEntityId: number | null = authenticatedUserId;
          if (createdByType === 'company') {
          }

          const kpiEntityToSave = manager.getRepository(Kpi).create({
            ...kpiData,
            calculation_type:
              kpiData.calculationType || kpiData.calculation_type,
            perspective_id: kpiData.perspectiveId || kpiData.perspective_id,
            start_date: kpiData.startDate || kpiData.start_date,
            end_date: kpiData.endDate || kpiData.end_date,
            memo: kpiData.description || kpiData.memo,
            created_by: creatorEntityId,
            created_by_type: createdByType,
            created_at: new Date(),
            updated_at: new Date(),
          });

          const saveResult = await manager
            .getRepository(Kpi)
            .save(kpiEntityToSave);

          let savedKpiObject: Kpi;

          if (Array.isArray(saveResult) && saveResult.length > 0) {
            savedKpiObject = saveResult[0];
          } else if (!Array.isArray(saveResult) && saveResult) {
            savedKpiObject = saveResult as Kpi;
          } else {
            console.error(
              'Lưu KPI thất bại hoặc trả về dữ liệu không mong đợi:',
              saveResult,
            );
            throw new Error(
              'Failed to save KPI or received unexpected result.',
            );
          }

          const assignmentEntities: KPIAssignment[] = [];
          const assignedByUserId = authenticatedUserId;

          if (assignments?.toDepartments) {
            for (const targetDepartment of assignments.toDepartments) {
              const assignment = new KPIAssignment();

              assignment.kpi = { id: savedKpiObject.id } as Kpi;
              assignment.assignedFrom = assignments?.from || createdByType;
              assignment.assigned_to_department = targetDepartment.id;
              assignment.targetValue =
                Number(targetDepartment.target) ?? Number(kpiData.target);
              assignment.assignedBy = assignedByUserId;
              assignment.status = 'draft';
              assignmentEntities.push(assignment);
            }
          }

          if (assignments?.toSections) {
            for (const targetSection of assignments.toSections) {
              const assignment = new KPIAssignment();

              assignment.kpi = { id: savedKpiObject.id } as Kpi;
              assignment.assignedFrom = assignments?.from || createdByType;
              assignment.assigned_to_section = targetSection.id;
              assignment.targetValue =
                Number(targetSection.target) ?? Number(kpiData.target);
              assignment.assignedBy = assignedByUserId;
              assignment.status = 'draft';
              assignmentEntities.push(assignment);
            }
          }

          if (assignments?.employeeId) {
            const assignedToEmployeeId = assignments.employeeId;
            const employeeAssignment = new KPIAssignment();

            employeeAssignment.kpi = { id: savedKpiObject.id } as Kpi;
            employeeAssignment.assignedFrom =
              assignments?.from || createdByType;
            employeeAssignment.assigned_to_employee = assignedToEmployeeId;
            employeeAssignment.employee_id = assignedToEmployeeId;
            employeeAssignment.targetValue = Number(kpiData.target);
            employeeAssignment.assignedBy = assignedByUserId;
            employeeAssignment.status = 'draft';
            assignmentEntities.push(employeeAssignment);
          }

          if (assignmentEntities.length > 0) {
            await manager.getRepository(KPIAssignment).save(assignmentEntities);
          }

          return savedKpiObject;
        } catch (error) {
          console.error('Transaction failed:', error);
          throw error;
        }
      },
    );
  }

  async update(id: number, update: Partial<Kpi>): Promise<Kpi> {
    await this.kpisRepository.update(id, update);
    return this.findOne(id);
  }

  async softDelete(id: number): Promise<void> {
    await this.kpisRepository.softDelete(id);
  }

  async remove(id: number): Promise<void> {
    await this.kpisRepository.delete(id);
  }

  async saveUserAssignments(
    kpiId: number,
    assignments: { user_id: number; target: number; weight?: number }[],
  ): Promise<KPIAssignment[]> {
    const kpi = await this.kpisRepository.findOne({ where: { id: kpiId } });
    if (!kpi) {
      throw new NotFoundException(`KPI with ID ${kpiId} not found`);
    }
    const assignedById = 1;
    const assignedFromType = kpi.created_by_type;
    const kpiWeight = kpi.weight;

    const allExistingUserAssignmentsIncludingSoftDeleted =
      await this.kpiAssignmentRepository.find({
        where: { kpi_id: kpiId, assigned_to_employee: Not(IsNull()) },
        withDeleted: true,
        relations: ['employee'],
      });

    const existingAssignmentsMap = new Map<number, KPIAssignment>();
    allExistingUserAssignmentsIncludingSoftDeleted.forEach((assignment) => {
      if (assignment.assigned_to_employee !== null) {
        existingAssignmentsMap.set(assignment.assigned_to_employee, assignment);
      }
    });

    const assignmentsToInsert: KPIAssignment[] = [];
    const assignmentsToSave: KPIAssignment[] = [];

    for (const incomingAssignment of assignments) {
      const existingAssignment = existingAssignmentsMap.get(
        incomingAssignment.user_id,
      );

      if (existingAssignment) {
        existingAssignment.targetValue = incomingAssignment.target;
        existingAssignment.updated_at = new Date();
        existingAssignment.deleted_at = null as any;

        assignmentsToSave.push(existingAssignment);
      } else {
        const newAssignment = this.kpiAssignmentRepository.create({
          kpi: { id: kpiId },
          assigned_to_employee: incomingAssignment.user_id,
          employee_id: incomingAssignment.user_id,
          targetValue: incomingAssignment.target,
          weight: kpiWeight,
          status: 'draft',
          assignedFrom: assignedFromType,
          assignedBy: assignedById,
          created_at: new Date(),
          updated_at: new Date(),
          assigned_to_department: null,
          assigned_to_section: null,
          assigned_to_team: null,
        } as unknown as import('typeorm').DeepPartial<KPIAssignment>);
        assignmentsToSave.push(newAssignment);
      }
    }

    await this.kpiAssignmentRepository.manager.transaction(async (manager) => {
      if (assignmentsToSave.length > 0) {
        await manager.save(
          KPIAssignment,
          assignmentsToSave as unknown as KPIAssignment[],
        );
      }
    });

    const updatedAssignmentsList = await this.getKpiAssignments(kpiId);

    return updatedAssignmentsList;
  }

  async deleteSectionAssignment(
    kpiId: number,
    sectionId: number,
  ): Promise<void> {
    const result = await this.kpiAssignmentRepository.update(
      { kpi_id: kpiId, assigned_to_section: sectionId },
      { deleted_at: new Date() },
    );

    if (result.affected === 0) {
      throw new NotFoundException(
        `Section Assignment with KPI ID ${kpiId} and Section ID ${sectionId} not found`,
      );
    }
  }

  async saveDepartmentAndSectionAssignments(
    kpiId: number,
    assignments: {
      assigned_to_department?: number;
      assigned_to_section?: number;
      targetValue: number;
      assignmentId?: number;
    }[],
  ): Promise<void> {
    const kpi = await this.kpisRepository.findOne({ where: { id: kpiId } });
    if (!kpi) {
      throw new NotFoundException(`KPI with ID ${kpiId} not found`);
    }
    const assignedFromType = kpi.created_by_type;
    const assignedById = 1;

    const newAssignments = assignments.map((assignment) => {
      const initialStatus = 'draft';

      return this.kpiAssignmentRepository.create({
        kpi: { id: kpiId },
        assignedFrom: assignedFromType,
        assignedBy: assignedById,
        targetValue: assignment.targetValue,
        status: initialStatus,
        assigned_to_department: assignment.assigned_to_department || null,
        assigned_to_section: assignment.assigned_to_section || null,
        assigned_to_team: null,
        assigned_to_employee: null,
        employee_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      } as unknown as import('typeorm').DeepPartial<KPIAssignment>);
    });
    await this.kpiAssignmentRepository.save(newAssignments);
  }
}
