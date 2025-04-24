import { plainToInstance } from 'class-transformer';
import { Department } from 'src/entities/department.entity';
import { KPIAssignment } from 'src/entities/kpi-assignment.entity';
import { Kpi } from 'src/entities/kpi.entity';
import { Section } from 'src/entities/section.entity';
import { Brackets, Repository } from 'typeorm';
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
      .leftJoinAndSelect('assignment.department', 'department') // typo fixed from "department"
      .leftJoinAndSelect('assignment.section', 'section')
      .leftJoinAndSelect('assignment.team', 'team')
      .leftJoinAndSelect('assignment.employee', 'employee')
      .leftJoinAndSelect('kpi.perspective', 'perspective')
      .leftJoinAndSelect('assignment.kpiValues', 'kpiValue') // <--- Join KPI values
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

    // TODO: temp, will check later
    // Calculate actual_value for each KPI directly from kpiValues
    const dataWithActualValue = data.map((kpi) => {
      const allValues = kpi.assignments
        .flatMap((assignment) => assignment.kpiValues)
        .map((value) => Number(value.value) || 0);

      const actual_value =
        kpi.calculation_type === 'sum'
          ? allValues.reduce((sum, val) => sum + val, 0) // Sum of all values
          : allValues.length > 0
            ? allValues.reduce((sum, val) => sum + val, 0) / allValues.length // Average of all values
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
      .leftJoinAndSelect('assignment.kpiValues', 'kpiValue') // Include KPI values
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

    // TODO: temp, will check later
    // Calculate actual_value for each KPI directly from kpiValues
    const dataWithActualValue = data.map((kpi) => {
      const allValues = kpi.assignments
        .flatMap((assignment) => assignment.kpiValues)
        .map((value) => Number(value.value) || 0);

      const actual_value =
        kpi.calculation_type === 'sum'
          ? allValues.reduce((sum, val) => sum + val, 0) // Sum of all values
          : allValues.length > 0
            ? allValues.reduce((sum, val) => sum + val, 0) / allValues.length // Average of all values
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
      .leftJoinAndSelect('assignment.kpiValues', 'kpiValue') // Include KPI values
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

    // Calculate actual_value for each KPI directly from kpiValues
    const dataWithActualValue = data.map((kpi) => {
      const allValues = kpi.assignments
        .flatMap((assignment) => assignment.kpiValues)
        .map((value) => Number(value.value) || 0);

      const actual_value =
        kpi.calculation_type === 'sum'
          ? allValues.reduce((sum, val) => sum + val, 0) // Sum of all values
          : allValues.length > 0
            ? allValues.reduce((sum, val) => sum + val, 0) / allValues.length // Average of all values
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
      .leftJoinAndSelect('assignment.kpiValues', 'kpiValue') // <--- Join KPI values
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
      relations: ['assignments', 'perspective'], // <-- Load assignments và perspective
    });

    if (!value) {
      throw new NotFoundException(`KPI with ID "${id}" not found`);
    }
    return value;
  }

  async getKpiAssignments(kpiId: number): Promise<KPIAssignment[]> {
    // Load tất cả KPIAssignments cho KPI này
    // Chỉ định tường minh tất cả các quan hệ @ManyToOne cần load
    // Điều này ghi đè eager: true nhưng làm rõ ý định
    return this.kpiAssignmentRepository.find({
      where: { kpi_id: kpiId },
      // Load tất cả các quan hệ @ManyToOne trên KPIAssignment
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
          const dto = plainToInstance(CreateKpiDto, createKpiDto); // Destructure incoming data, EXCLUDE id if it exists
          const { assignments, id, ...kpiData } = dto as any; // Create the KPI object

          let createdByType = 'company'; // Default
          if (assignments?.toSections && assignments.toSections.length > 0) {
            // <== Check Section trước
            createdByType = 'section';
          } else if (
            assignments?.toDepartments &&
            assignments.toDepartments.length > 0
          ) {
            // <== Check Department sau
            createdByType = 'department';
          }

          const kpi = manager.getRepository(Kpi).create({
            ...kpiData, // Ánh xạ các trường DTO sang entity
            min_target: kpiData.minimum,
            mid_target: kpiData.middle,
            max_target: kpiData.maximum,
            calculation_type: kpiData.calculationType,
            perspective_id: kpiData.perspectiveId,
            start_date: kpiData.startDate,
            end_date: kpiData.endDate,
            memo: kpiData.description,
            created_by: 1, // TODO: userID will obtain from JWT (cần lấy từ request user)
            // Set created_by_type dựa trên assignments.from
            created_by_type: createdByType, // <-- Lấy từ assignments.from
          }); // Save the KPI object.

          const savedKpi = (await manager
            .getRepository(Kpi)
            .save(kpi)) as unknown as Kpi; // ... phần xử lý và lưu assignments ...

          const assignmentEntities: KPIAssignment[] = []; // Handle department assignments

          if (assignments?.toDepartments) {
            for (const targetDepartment of assignments.toDepartments) {
              const assignment = new KPIAssignment();
              assignment.kpi = savedKpi;
              assignment.assignedFrom = assignments.from; // <-- Lấy từ assignments.from
              assignment.assigned_to_department = targetDepartment.id;

              if (targetDepartment.target !== undefined) {
                assignment.targetValue = Number(targetDepartment.target);
              }

              assignment.assignedBy = 1; // TODO: userID will obtain from JWT

              assignmentEntities.push(assignment);
            }
          } // Handle section assignments

          if (assignments?.toSections) {
            for (const targetSection of assignments.toSections) {
              const assignment = new KPIAssignment();
              assignment.kpi = savedKpi;
              assignment.assignedFrom = assignments.from; // <-- Lấy từ assignments.from
              assignment.assigned_to_section = targetSection.id;

              if (targetSection.target !== undefined) {
                assignment.targetValue = Number(targetSection.target);
              }

              assignment.assignedBy = 1; // TODO: userID will obtain from JWT

              assignmentEntities.push(assignment);
            }
          }

          // Handle employee assignment
          if (assignments?.employeeId) {
            const targetEmployeeId = assignments.employeeId;

            const employeeAssignment = new KPIAssignment();
            employeeAssignment.kpi = savedKpi;
            employeeAssignment.assignedFrom = assignments.from; // <-- Lấy từ assignments.from
            employeeAssignment.assigned_to_employee = targetEmployeeId;
            employeeAssignment.employee_id = targetEmployeeId;

            employeeAssignment.targetValue = kpiData.target;

            employeeAssignment.assignedBy = 1; // TODO: userID will obtain from JWT
            employeeAssignment.status = 'draft';

            assignmentEntities.push(employeeAssignment);
          } // Save all assignments

          await manager.getRepository(KPIAssignment).save(assignmentEntities);

          return savedKpi; // Trả về KPI đã lưu
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
    // Xóa các assignment cũ liên quan đến KPI
    await this.kpiAssignmentRepository.delete({ kpi_id: kpiId });

    // Tạo mới các assignment
    const newAssignments = assignments.map((assignment) =>
      this.kpiAssignmentRepository.create({
        kpi_id: kpiId,
        employee_id: assignment.user_id,
        targetValue: assignment.target,
        created_at: new Date(),
        updated_at: new Date(),
        assignedBy: 1, // TODO: userID will obtain from JWT
        status: 'draft',
      }),
    );

    // Lưu vào database
    return this.kpiAssignmentRepository.save(newAssignments);
  }

  async deleteSectionAssignment(
    kpiId: number,
    sectionId: number,
  ): Promise<void> {
    const result = await this.kpiAssignmentRepository.update(
      { kpi_id: kpiId, assigned_to_section: sectionId },
      { deleted_at: new Date() }, // ✅ Soft delete bằng cách gán timestamp
    );

    if (result.affected === 0) {
      throw new NotFoundException(
        `Section Assignment with KPI ID ${kpiId} and Section ID ${sectionId} not found`,
      );
    }
  }

  async saveSectionAssignments(
    kpiId: number,
    assignments: { section_id: number; target: number; weight: number }[],
  ): Promise<void> {
    // Xóa các Section Assignments cũ liên quan đến KPI
    await this.kpiAssignmentRepository.delete({ kpi_id: kpiId });

    // Tạo mới các Section Assignments
    const newAssignments = assignments.map((assignment) =>
      this.kpiAssignmentRepository.create({
        kpi_id: kpiId,
        assigned_to_section: assignment.section_id,
        targetValue: assignment.target,
        created_at: new Date(),
        updated_at: new Date(),
      }),
    );

    // Lưu vào database
    await this.kpiAssignmentRepository.save(newAssignments);
  }
}
