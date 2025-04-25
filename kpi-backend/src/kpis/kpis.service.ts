import { plainToInstance } from 'class-transformer';
import { Department } from 'src/entities/department.entity';
import { KPIAssignment } from 'src/entities/kpi-assignment.entity';
import { Kpi } from 'src/entities/kpi.entity';
import { Section } from 'src/entities/section.entity';
import { Brackets, IsNull, Not, Repository } from 'typeorm';
import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
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
      .where('kpi.assignments.assigned_to_employee = :id', { id: employeeId })
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
      .leftJoinAndSelect('kpi.perspective', 'perspective')
      .leftJoinAndSelect('assignment.kpiValues', 'kpiValue') 
      .where('kpi.deleted_at IS NULL');

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

    
    
    const dataWithActualValue = data.map((kpi) => {
      const allValues = kpi.assignments
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
      .where(
        new Brackets((qb) => {
          qb.where(
            'kpi.created_by_type = :createdType AND kpi.created_by = :departmentId',
            {
              createdType: 'department',
              departmentId,
            },
          ).orWhere('assignment.assigned_to_department = :departmentId', {
            departmentId,
          });
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

    
    
    const dataWithActualValue = data.map((kpi) => {
      const allValues = kpi.assignments
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
      .leftJoinAndSelect('assignment.kpiValues', 'kpiValues')
      .where('assignment.assigned_to_department IS NOT NULL')
      .getMany();
  }

  async getAllKpiAssignedToSections(): Promise<Kpi[]> {
    return this.kpisRepository
      .createQueryBuilder('kpi')
      .leftJoinAndSelect('kpi.perspective', 'perspective')
      .leftJoinAndSelect('kpi.assignments', 'assignment')
      .leftJoinAndSelect('assignment.section', 'section')
      .leftJoinAndSelect('assignment.employee', 'employee')
      .leftJoinAndSelect('assignment.kpiValues', 'kpiValues')
      .where('assignment.assigned_to_section IS NOT NULL')
      .getMany();
  }

  async getSectionKpis(
    sectionId: number,
    filterDto: KpiFilterDto,
  ): Promise<{
    data: (Kpi & { actual_value: number })[];
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
      .leftJoinAndSelect('assignment.team', 'team')
      .leftJoinAndSelect('assignment.employee', 'employee')
      .leftJoinAndSelect('kpi.perspective', 'perspective')
      .leftJoinAndSelect('assignment.kpiValues', 'kpiValue') 
      .where(
        new Brackets((qb) => {
          qb.where(
            'kpi.created_by_type = :createdType AND kpi.created_by = :sectionId',
            {
              createdType: 'section',
              sectionId,
            },
          ).orWhere('assignment.assigned_to_section = :sectionId', {
            sectionId,
          });
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

    if (filterDto.teamId) {
      query.andWhere('assignment.assigned_to_team = :teamId', {
        teamId: filterDto.teamId,
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

    
    const dataWithActualValue = data.map((kpi) => {
      const allValues = kpi.assignments
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
    
    return this.kpiAssignmentRepository.find({
      where: { kpi_id: kpiId },
      relations: [
        'kpi',
        'department',
        'section',
        'team',
        'employee',
        'kpiValues',
      ],
    });
  }

  async create(createKpiDto: CreateKpiDto): Promise<Kpi> {
    return await this.kpisRepository.manager.transaction(
      async (manager): Promise<Kpi> => {
        try {
          const dto = plainToInstance(CreateKpiDto, createKpiDto); 
          const { assignments, id, ...kpiData } = dto as any; 

          let createdByType = 'company'; 
          console.log('assignmentsassignmentsassignments', assignments);
          if (assignments.from && assignments.from === 'employee') {
            createdByType = 'employee';
          } else if (
            assignments?.toSections &&
            assignments.toSections.length > 0
          ) {
            createdByType = 'section';
          } else if (
            assignments?.toDepartments &&
            assignments.toDepartments.length > 0
          ) {
            createdByType = 'department';
          }

          const kpi = manager.getRepository(Kpi).create({
            ...kpiData, 
            min_target: kpiData.minimum,
            mid_target: kpiData.middle,
            max_target: kpiData.maximum,
            calculation_type: kpiData.calculationType,
            perspective_id: kpiData.perspectiveId,
            start_date: kpiData.startDate,
            end_date: kpiData.endDate,
            memo: kpiData.description,
            created_by: 1, 
            
            created_by_type: createdByType, 
          }); 

          const savedKpi = (await manager
            .getRepository(Kpi)
            .save(kpi)) as unknown as Kpi; 

          const assignmentEntities: KPIAssignment[] = []; 

          if (assignments?.toDepartments) {
            for (const targetDepartment of assignments.toDepartments) {
              const assignment = new KPIAssignment();
              assignment.kpi = savedKpi;
              assignment.assignedFrom = assignments.from; 
              assignment.assigned_to_department = targetDepartment.id;

              if (targetDepartment.target !== undefined) {
                assignment.targetValue = Number(targetDepartment.target);
              }

              assignment.assignedBy = 1; 

              assignmentEntities.push(assignment);
            }
          } 

          if (assignments?.toSections) {
            for (const targetSection of assignments.toSections) {
              const assignment = new KPIAssignment();
              assignment.kpi = savedKpi;
              assignment.assignedFrom = assignments.from; 
              assignment.assigned_to_section = targetSection.id;

              if (targetSection.target !== undefined) {
                assignment.targetValue = Number(targetSection.target);
              }

              assignment.assignedBy = 1; 

              assignmentEntities.push(assignment);
            }
          }

          if (assignments?.employeeId) {
            const targetEmployeeId = assignments.employeeId;

            const employeeAssignment = new KPIAssignment();
            employeeAssignment.kpi = savedKpi;
            employeeAssignment.assignedFrom = assignments.from; 
            employeeAssignment.assigned_to_employee = targetEmployeeId;
            employeeAssignment.employee_id = targetEmployeeId;

            employeeAssignment.targetValue = kpiData.target;

            employeeAssignment.assignedBy = 1; 
            employeeAssignment.status = 'draft';

            assignmentEntities.push(employeeAssignment);
          } 

          await manager.getRepository(KPIAssignment).save(assignmentEntities);

          return savedKpi; 
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
    assignments: { user_id: number; target: number }[], 
  ): Promise<KPIAssignment[]> {

    const kpi = await this.kpisRepository.findOne({ where: { id: kpiId } });
    if (!kpi) {
      throw new NotFoundException(`KPI with ID ${kpiId} not found`);
    } 
    const assignedFromType = kpi.created_by_type; 
    const assignedById = 1; 
    const kpiWeight = kpi.weight; 

    const existingUserAssignments = await this.kpiAssignmentRepository.find({
      where: {
        kpi_id: kpiId,
        assigned_to_employee: Not(IsNull()), 
        deleted_at: IsNull(), 
      },
      relations: ['employee'], 
    }); 

    const existingAssignmentsMap = new Map<number, KPIAssignment>();
    existingUserAssignments.forEach((assignment) => {
      if (assignment.assigned_to_employee !== null) {
        existingAssignmentsMap.set(assignment.assigned_to_employee, assignment);
      }
    });

    const incomingUserIds = new Set<number>(
      assignments.map((assign) => assign.user_id),
    );

    const assignmentsToInsert: KPIAssignment[] = [];
    const assignmentsToUpdate: KPIAssignment[] = []; 
    for (const incomingAssignment of assignments) {
      const existingAssignment = existingAssignmentsMap.get(
        incomingAssignment.user_id,
      );

      if (existingAssignment) {
        if (
          existingAssignment.targetValue !==
          incomingAssignment.target /* Add other fields if editable */
        ) {
          existingAssignment.targetValue = incomingAssignment.target;
          existingAssignment.updated_at = new Date();
          assignmentsToUpdate.push(existingAssignment);
        }
      } else {
        
        const newAssignment = this.kpiAssignmentRepository.create(
          {
            
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
          } as unknown as import('typeorm').DeepPartial<KPIAssignment>, 
        );
        assignmentsToInsert.push(newAssignment);
      }
    } 

    const assignmentsToDelete = existingUserAssignments.filter(
      (assignment) =>
        assignment.assigned_to_employee !== null &&
        !incomingUserIds.has(assignment.assigned_to_employee),
    ); 

    await this.kpiAssignmentRepository.manager.transaction(async (manager) => {
      
      if (assignmentsToDelete.length > 0) {
        await manager.softRemove(assignmentsToDelete); 
      } 
      if (assignmentsToInsert.length > 0) {
        
        await manager.save(
          KPIAssignment,
          assignmentsToInsert as unknown as KPIAssignment[],
        );
      } 

      if (assignmentsToUpdate.length > 0) {
        
        await manager.save(
          KPIAssignment,
          assignmentsToUpdate as unknown as KPIAssignment[],
        );
      }
    }); 
 
    return this.kpiAssignmentRepository.find({
      where: {
        kpi_id: kpiId,
        assigned_to_employee: Not(IsNull()),
        deleted_at: IsNull(),
      },
      relations: ['employee', 'kpiValues'], 
    });
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

      return this.kpiAssignmentRepository.create(
        
        {
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
        } as unknown as import('typeorm').DeepPartial<KPIAssignment>, 
      );
    }); 
    await this.kpiAssignmentRepository.save(newAssignments);
  }
}
