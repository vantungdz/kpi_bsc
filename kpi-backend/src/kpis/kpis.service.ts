import { plainToInstance } from 'class-transformer';
import { Department } from 'src/entities/department.entity';
import { KPIAssignment } from 'src/entities/kpi-assignment.entity';
import { Section } from 'src/entities/section.entity';
import { Team } from 'src/entities/team.entity';
import { Employee } from '../entities/employee.entity';
import { KpiValue, KpiValueStatus } from 'src/entities/kpi-value.entity';
import { Perspective } from 'src/entities/perspective.entity';
import { Kpi, KpiDefinitionStatus } from 'src/entities/kpi.entity'; 
import { Brackets, DataSource, DeepPartial, IsNull, Not, Repository } from 'typeorm';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateKpiDto } from './dto/create_kpi_dto';
import { KpiFilterDto } from './dto/filter-kpi.dto';
import { OnEvent } from '@nestjs/event-emitter';

interface AssignmentWithLatestValue extends KPIAssignment {
  latest_actual_value?: number | null; 
  latest_value_timestamp?: Date | null; 
}

interface KpiDetailWithProcessedAssignments extends Kpi {
  assignments: AssignmentWithLatestValue[];
}

@Injectable()
export class KpisService {
  private readonly logger = new Logger(KpisService.name);
  constructor(
    private dataSource: DataSource,
    @InjectRepository(Kpi)
    private readonly kpisRepository: Repository<Kpi>,
    @InjectRepository(KPIAssignment)
    private readonly kpiAssignmentRepository: Repository<KPIAssignment>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
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

  private aggregateValues(
    calcType: string,
    values: number[],
    targets: number[],
  ): number | null {
    if (values.length === 0) {
      return null;
    }
    let result: number | null = null;
    try {
      switch (calcType) {
        case 'sum':
          result = values.reduce((sum, val) => sum + val, 0);
          break;
        case 'average':
          result = values.reduce((sum, val) => sum + val, 0) / values.length;
          break;
        case 'percentage':
          if (values.length === targets.length && targets.length > 0) {
            const sumActual = values.reduce((sum, val) => sum + val, 0);
            const sumTarget = targets.reduce((sum, val) => sum + val, 0);
            result = sumTarget > 0 ? (sumActual / sumTarget) * 100 : null;
          } else {
            result = null;
          }
          break;
        default:
          result = null;
      }
      return result === null || isNaN(result)
        ? null
        : parseFloat(result.toFixed(2));
    } catch (error) {
      this.logger.error(
        `Error during aggregation with type ${calcType}:`,
        error,
      );
      return null;
    }
  }

  async findOne(id: number): Promise<KpiDetailWithProcessedAssignments> {
    this.logger.log(
      `Finding KPI Detail for ID: ${id} using QueryBuilder with Aggregation`,
    );
    try {
      const kpi = await this.kpisRepository
        .createQueryBuilder('kpi')
        .leftJoinAndSelect('kpi.perspective', 'perspective')
        .leftJoinAndSelect(
          'kpi.assignments',
          'assignment',
          'assignment.deleted_at IS NULL',
        )
        .leftJoinAndSelect('assignment.kpiValues', 'kpiValue')
        .leftJoinAndSelect('assignment.department', 'department')
        .leftJoinAndSelect('assignment.section', 'section')
        .leftJoinAndSelect('assignment.team', 'team')
        .leftJoinAndSelect('assignment.employee', 'employee')
        .leftJoinAndSelect('section.department', 'sectionDepartment')
        .leftJoinAndSelect('employee.department', 'employeeDepartment')
        .leftJoinAndSelect('employee.section', 'employeeSection')
        .where('kpi.id = :id', { id })
        .andWhere('kpi.deleted_at IS NULL')
        .orderBy({ 'assignment.id': 'ASC', 'kpiValue.timestamp': 'DESC' })
        .getOne();

      if (!kpi) {
        throw new NotFoundException(`KPI with ID "${id}" not found`);
      }
      if (!kpi.assignments) {
        kpi.assignments = [];
      }

      this.logger.debug(
        `Found KPI ${id}. Found ${kpi.assignments.length} raw assignments.`,
      );

      const employeeLatestApprovedValues = new Map<
        number,
        { value: number | null; target: number | null }
      >();
      kpi.assignments
        .filter((a) => a.assigned_to_employee != null)
        .forEach((assign) => {
          const employeeId = assign.assigned_to_employee;
          if (employeeId === null || employeeId === undefined) {
            this.logger.warn(
              `Skipping assignment ID ${assign.id} because assigned_to_employee is null/undefined.`,
            );
            return;
          }

          let latestApprovedValue: number | null = null;
          if (assign.kpiValues && assign.kpiValues.length > 0) {
            const approved = assign.kpiValues
              .filter((v) => v.status === KpiValueStatus.APPROVED)
              .sort(
                (a, b) =>
                  new Date(b.updated_at || b.created_at).getTime() -
                  new Date(a.updated_at || a.created_at).getTime(),
              );
            if (approved.length > 0 && approved[0].value != null) {
              latestApprovedValue = Number(approved[0].value);
              if (isNaN(latestApprovedValue)) latestApprovedValue = null;
            }
          }
          employeeLatestApprovedValues.set(employeeId, {
            value: latestApprovedValue,
            target: assign.targetValue ?? null,
          });
        });
      this.logger.debug(
        `Calculated Employee Latest Approved Values: ${JSON.stringify(Array.from(employeeLatestApprovedValues.entries()))}`,
      );

      const processedAssignments = kpi.assignments.map((assignment) => {
        let calculatedActualValue: number | null = null;

        if (assignment.assigned_to_employee) {
          calculatedActualValue =
            employeeLatestApprovedValues.get(assignment.assigned_to_employee)
              ?.value ?? null;
        } else if (assignment.assigned_to_section) {
          const sectionId = assignment.assigned_to_section;
          const relevantValues: number[] = [];
          const relevantTargets: number[] = [];
          kpi.assignments.forEach((empAssign) => {
            if (
              empAssign.assigned_to_employee &&
              empAssign.employee?.sectionId === sectionId
            ) {
              const empData = employeeLatestApprovedValues.get(
                empAssign.assigned_to_employee,
              );
              if (empData && empData.value !== null) {
                relevantValues.push(empData.value);
                if (
                  kpi.calculation_type === 'percentage' &&
                  empData.target !== null
                ) {
                  relevantTargets.push(empData.target);
                }
              }
            }
          });
          calculatedActualValue = this.aggregateValues(
            kpi.calculation_type,
            relevantValues,
            relevantTargets,
          );
          this.logger.debug(
            `Calculated Section ${sectionId} Value: ${calculatedActualValue} from ${relevantValues.length} employees.`,
          );
        } else if (assignment.assigned_to_department) {
          const departmentId = assignment.assigned_to_department;
          const relevantValues: number[] = [];
          const relevantTargets: number[] = [];
          kpi.assignments.forEach((empAssign) => {
            if (
              empAssign.assigned_to_employee &&
              empAssign.employee?.departmentId === departmentId
            ) {
              const empData = employeeLatestApprovedValues.get(
                empAssign.assigned_to_employee,
              );
              if (empData && empData.value !== null) {
                relevantValues.push(empData.value);
                if (
                  kpi.calculation_type === 'percentage' &&
                  empData.target !== null
                ) {
                  relevantTargets.push(empData.target);
                }
              }
            }
          });
          calculatedActualValue = this.aggregateValues(
            kpi.calculation_type,
            relevantValues,
            relevantTargets,
          );
          this.logger.debug(
            `Calculated Department ${departmentId} Value: ${calculatedActualValue} from ${relevantValues.length} employees.`,
          );
        }

        return {
          ...assignment,
          latest_actual_value: calculatedActualValue,
        } as AssignmentWithLatestValue;
      });

      kpi.assignments = processedAssignments;

      return kpi as KpiDetailWithProcessedAssignments;
    } catch (error) {
      this.logger.error(
        `Error in findOne Aggregation for KPI ID ${id}:`,
        error,
      );
      throw error;
    }
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
      order: {
        employee: {
          first_name: 'ASC',
          last_name: 'ASC',
        },
      },
    });

    const processedAssignments = assignments.map((assignment) => {
      let latestValue: number | null = null;
      let latestTimestamp: Date | null = null;

      if (assignment.kpiValues && assignment.kpiValues.length > 0) {
        const sortedValues = [...assignment.kpiValues].sort(
          (a, b) =>
            new Date(b.updated_at || b.timestamp).getTime() -
            new Date(a.updated_at || a.timestamp).getTime(),
        );
        const latestKpiValue = sortedValues[0];

        if (latestKpiValue) {
          latestValue = latestKpiValue.value;
          latestTimestamp =
            latestKpiValue.timestamp || latestKpiValue.updated_at;
        }
      }
      const result: AssignmentWithLatestValue = {
        ...assignment,
        latest_actual_value: latestValue,
        latest_value_timestamp: latestTimestamp,
      };

      return result;
    });

    return processedAssignments;
  }

  async toggleKpiStatus(id: number, userId: number): Promise<Kpi> {
    return await this.dataSource.transaction(async (manager) => {
      const kpiRepo = manager.getRepository(Kpi);
      const assignmentRepo = manager.getRepository(KPIAssignment);
      const employeeRepo = manager.getRepository(Employee);

      const kpi = await kpiRepo.findOneBy({ id });
      if (!kpi) {
        throw new NotFoundException(`KPI with ID ${id} not found`);
      }

      const user = await employeeRepo.findOneBy({ id: userId });
      if (!user || !['manager', 'admin'].includes(user.role)) {
        throw new UnauthorizedException(
          'User does not have permission to change KPI status.',
        );
      }

      const newKpiStatus =
        kpi.status === KpiDefinitionStatus.DRAFT
          ? KpiDefinitionStatus.APPROVED
          : KpiDefinitionStatus.DRAFT;

      const newAssignmentStatus =
        newKpiStatus === KpiDefinitionStatus.APPROVED ? 'approved' : 'draft';

      kpi.status = newKpiStatus;
      kpi.updated_by = userId;
      kpi.updated_at = new Date();
      const updatedKpi = await kpiRepo.save(kpi);

      this.logger.log(
        `[toggleKpiStatus] User ${userId} toggled KPI ${id} status to ${newKpiStatus}`,
      );

      this.logger.log(
        `Updating associated assignments for KPI ${id} to status '${newAssignmentStatus}'`,
      );
      const updateResult = await assignmentRepo.update(
        { kpi_id: id },
        { status: newAssignmentStatus, updated_at: new Date() },
      );
      this.logger.log(
        `Updated ${updateResult.affected} assignment statuses for KPI ${id}.`,
      );

      return updatedKpi;
    });
  }

  async recalculateKpiActualValue(kpiId: number): Promise<void> {
    this.logger.log(`Recalculating actual value for KPI ID: ${kpiId}`);
    try {
      const kpi = await this.kpisRepository.findOne({
        where: { id: kpiId },
      });

      if (!kpi) {
        this.logger.error(`KPI with ID ${kpiId} not found for recalculation.`);
        return;
      }

      const assignments = await this.kpiAssignmentRepository.find({
        where: { kpi_id: kpiId, deleted_at: IsNull() },
        relations: ['kpiValues'],
      });

      const latestApprovedValues: number[] = [];
      const correspondingTargets: number[] = [];

      if (assignments && assignments.length > 0) {
        for (const assignment of assignments) {
          const latestApprovedValueRecord = assignment.kpiValues
            ?.filter((v) => v.status === KpiValueStatus.APPROVED)
            .sort(
              (a, b) =>
                new Date(b.timestamp).getTime() -
                new Date(a.timestamp).getTime(),
            )[0];

          if (latestApprovedValueRecord) {
            latestApprovedValues.push(latestApprovedValueRecord.value);

            if (
              kpi.calculation_type === 'percentage' &&
              assignment.targetValue != null
            ) {
              correspondingTargets.push(assignment.targetValue);
            }
          }
        }
      }

      let newActualValue: number | null = null;

      if (latestApprovedValues.length > 0) {
        this.logger.debug(
          `Calculating actual value for KPI ${kpiId} based on ${latestApprovedValues.length} approved values.`,
        );
        switch (kpi.calculation_type) {
          case 'sum':
            newActualValue = latestApprovedValues.reduce(
              (sum, val) => sum + Number(val || 0),
              0,
            );
            break;
          case 'average':
            const sumForAvg = latestApprovedValues.reduce(
              (sum, val) => sum + Number(val || 0),
              0,
            );
            newActualValue = sumForAvg / latestApprovedValues.length;
            break;
          case 'percentage':
            if (
              latestApprovedValues.length === correspondingTargets.length &&
              correspondingTargets.length > 0
            ) {
              const sumActual = latestApprovedValues.reduce(
                (sum, val) => sum + Number(val || 0),
                0,
              );
              const sumTarget = correspondingTargets.reduce(
                (sum, val) => sum + Number(val || 0),
                0,
              );

              if (sumTarget > 0) {
                newActualValue = (sumActual / sumTarget) * 100;
              } else {
                this.logger.warn(
                  `Cannot calculate percentage for KPI ${kpiId}: Sum of targets is 0.`,
                );
                newActualValue = null;
              }
            } else {
              this.logger.warn(
                `Cannot calculate percentage for KPI ${kpiId}: Mismatch count or no targets found. Values: ${latestApprovedValues.length}, Targets: ${correspondingTargets.length}`,
              );
              newActualValue = null;
            }
            break;
          default:
            this.logger.warn(
              `Unknown calculation_type '${kpi.calculation_type}' for KPI ${kpiId}. Setting actual_value to null.`,
            );
            newActualValue = null;
        }
      } else {
        this.logger.log(
          `No approved values found for KPI ${kpiId}. Setting actual_value to null.`,
        );
        newActualValue = null;
      }

      const finalActualValue =
        newActualValue === null ? null : parseFloat(newActualValue.toFixed(2));

      if (kpi.actual_value !== finalActualValue) {
        kpi.actual_value = finalActualValue;
        kpi.updated_at = new Date();

        await this.kpisRepository.save(kpi);
        this.logger.log(
          `Successfully recalculated and saved actual_value (${kpi.actual_value}) for KPI ID: ${kpiId}`,
        );
      } else {
        this.logger.log(
          `Actual value for KPI ID ${kpiId} remains unchanged (${kpi.actual_value}). No update needed.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error during recalculateKpiActualValue for KPI ID ${kpiId}:`,
        error,
      );
    }
  }

  @OnEvent('kpi_value.approved', { async: true })
  async handleKpiValueApproved(payload: { kpiId: number }) {
    if (!payload || typeof payload.kpiId !== 'number') {
      this.logger.error(
        'Invalid payload received for kpi_value.approved event:',
        payload,
      );
      return;
    }
    this.logger.log(
      `Received kpi_value.approved event for KPI ID: ${payload.kpiId}. Triggering recalculation...`,
    );
    try {
      await this.recalculateKpiActualValue(payload.kpiId);
    } catch (error) {
      this.logger.error(
        `Listener failed during recalculateKpiActualValue for KPI ID ${payload.kpiId}:`,
        error,
      );
    }
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
    assignmentsData: {
      assigned_to_department?: number | null;
      assigned_to_section?: number | null;
      targetValue: number;
      assignmentId?: number | null;
    }[],
    // userId: number // Nên truyền userId vào
  ): Promise<void> {
    const userId = 1; // TODO: Thay bằng ID người dùng thực tế

    return await this.dataSource.transaction(async (manager) => {
      const kpiRepo = manager.getRepository(Kpi);
      const assignmentRepo = manager.getRepository(KPIAssignment);

      const kpi = await kpiRepo.findOneBy({ id: kpiId });
      if (!kpi) {
        throw new NotFoundException(`KPI with ID ${kpiId} not found`);
      }

      const entitiesToSave: KPIAssignment[] = [];

      for (const assignmentData of assignmentsData) {
        if (assignmentData.assignmentId) {
          this.logger.log(
            `Updating assignment ID: ${assignmentData.assignmentId}`,
          );
          try {
            const existingAssignment = await assignmentRepo.findOneByOrFail({
              id: assignmentData.assignmentId,
              kpi_id: kpiId,
            });

            existingAssignment.targetValue = assignmentData.targetValue;
            existingAssignment.updated_at = new Date();
            entitiesToSave.push(existingAssignment);
          } catch (error) {
            if (error.name === 'EntityNotFoundError') {
              this.logger.warn(
                `Assignment with ID ${assignmentData.assignmentId} not found for KPI ${kpiId}. Skipping update.`,
              );
              // Bỏ qua lần lặp này nếu không tìm thấy assignment để update
              continue;
            } else {
              throw error;
            }
          }
        } else {
          this.logger.log(
            `Creating new assignment for Dept: ${assignmentData.assigned_to_department}, Section: ${assignmentData.assigned_to_section}`,
          );
          if (
            assignmentData.assigned_to_department &&
            assignmentData.assigned_to_section
          ) {
            this.logger.warn(
              `Assignment data provides both department and section ID. Prioritizing section ID ${assignmentData.assigned_to_section}.`,
            );
            assignmentData.assigned_to_department = null;
          }
          if (
            !assignmentData.assigned_to_department &&
            !assignmentData.assigned_to_section
          ) {
            throw new BadRequestException(
              'Assignment target (Department or Section) is required for new assignments.',
            );
          }

          const initialStatus =
            kpi.status === KpiDefinitionStatus.APPROVED
              ? KpiDefinitionStatus.APPROVED
              : KpiDefinitionStatus.DRAFT;

          const newAssignment = assignmentRepo.create({
            kpi: { id: kpiId } as Kpi,
            assignedFrom: kpi.created_by_type,
            assignedBy: userId,
            targetValue: assignmentData.targetValue,
            status: initialStatus,
            assigned_to_department:
              assignmentData.assigned_to_department || null,
            assigned_to_section: assignmentData.assigned_to_section || null,
            assigned_to_team: null,
            assigned_to_employee: null,
            employee_id: null,
            created_at: new Date(),
            updated_at: new Date(),
            assignedAt: new Date(),
          } as DeepPartial<KPIAssignment>);
          entitiesToSave.push(newAssignment);
        }
      }

      if (entitiesToSave.length > 0) {
        await assignmentRepo.save(entitiesToSave);
        this.logger.log(
          `Saved ${entitiesToSave.length} department/section assignments for KPI ${kpiId}.`,
        );
      }
    });
  }
}
