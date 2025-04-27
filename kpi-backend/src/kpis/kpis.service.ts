// backend/kpis.service.ts

import { plainToInstance } from 'class-transformer';
import { Department } from 'src/entities/department.entity';
import { KPIAssignment } from 'src/entities/kpi-assignment.entity';
import { Kpi } from 'src/entities/kpi.entity';
import { Section } from 'src/entities/section.entity';
import { Team } from 'src/entities/team.entity'; // <-- Thêm import
import { Employee } from 'src/entities/employee.entity'; // <-- Thêm import
import { KpiValue } from 'src/entities/kpi-value.entity'; // <-- Thêm import
import { Perspective } from 'src/entities/perspective.entity'; // <-- Thêm import
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
  ) {} // Phương thức getKpisByEmployeeId (đã thêm join và lọc soft delete)

  async getKpisByEmployeeId(employeeId: number): Promise<Kpi[]> {
    return (
      this.kpisRepository
        .createQueryBuilder('kpi')
        .leftJoinAndSelect('kpi.assignments', 'assignment') // Load assignments (eager on Kpi)
        // Load relations on assignment (eager on KPIAssignment)
        .leftJoinAndSelect('assignment.employee', 'employee')
        .leftJoinAndSelect('assignment.section', 'section')
        .leftJoinAndSelect('assignment.department', 'department') // Load department if assigned directly
        .leftJoinAndSelect('assignment.team', 'team') // Load team
        // Thêm join để có thể truy cập section.department
        .leftJoinAndSelect('section.department', 'departmentOfSection') // <-- Thêm join
        .leftJoinAndSelect('kpi.perspective', 'perspective') // Load perspective (eager on Kpi)
        .leftJoinAndSelect('assignment.kpiValues', 'kpiValue') // Load kpi values
        .where('kpi.deleted_at IS NULL') // Filter non-soft-deleted KPIs
        .andWhere('assignment.deleted_at IS NULL') // <-- Thêm lọc soft delete assignment
        .andWhere('assignment.assigned_to_employee = :id', { id: employeeId }) // Lọc theo employeeId
        .getMany()
    );
  } // Phương thức findAll (đã thêm join và lọc soft delete)

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
      .leftJoinAndSelect('kpi.assignments', 'assignment') // Load assignments (eager on Kpi)
      // Load relations on assignment (eager on KPIAssignment)
      .leftJoinAndSelect('assignment.department', 'department')
      .leftJoinAndSelect('assignment.section', 'section')
      .leftJoinAndSelect('assignment.team', 'team')
      .leftJoinAndSelect('assignment.employee', 'employee') // Thêm join để có thể truy cập section.department
      .leftJoinAndSelect('section.department', 'departmentOfSection') // <-- Thêm join
      .leftJoinAndSelect('kpi.perspective', 'perspective') // Load perspective (eager on Kpi)
      .leftJoinAndSelect('assignment.kpiValues', 'kpiValue') // Load kpi values
      .where('kpi.deleted_at IS NULL'); // Filter non-soft-deleted KPIs
    // Thêm điều kiện lọc soft delete cho Assignment

    query.andWhere('assignment.deleted_at IS NULL'); // <-- Thêm lọc soft delete assignment

    if (filterDto.name) {
      query.andWhere('kpi.name ILIKE :name', {
        name: `%${filterDto.name}%`,
      });
    }

    if (filterDto.perspectiveId) {
      query.andWhere('kpi.perspective_id = :perspectiveId', {
        perspectiveId: filterDto.perspectiveId,
      });
    } // Các bộ lọc filterDto.departmentId, filterDto.sectionId, filterDto.teamId ở đây
    // lọc assignment dựa trên ID trực tiếp

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
    } // assuming assignedToId filters employee assignments

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

    query.distinct(true); // Đảm bảo distinct

    const validSortColumns = ['name', 'created_at'];
    const sortBy = validSortColumns.includes(filterDto.sortBy ?? '')
      ? filterDto.sortBy!
      : 'created_at';
    const sortOrder = filterDto.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    query.orderBy(`kpi.${sortBy}`, sortOrder);

    const [data, totalItems] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount(); // Tính toán actual_value (giữ nguyên logic hiện có)

    const dataWithActualValue = data.map((kpi) => {
      // Filter assignments in memory to only include non-soft-deleted ones,
      // although the query already filters assignment.deleted_at IS NULL
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
  } // Phương thức getDepartmentKpis (đã thêm join và lọc soft delete)

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
      .leftJoinAndSelect('kpi.assignments', 'assignment') // Load assignments (eager)
      // Load relations on assignment (eager)
      .leftJoinAndSelect('assignment.section', 'section')
      .leftJoinAndSelect('assignment.team', 'team')
      .leftJoinAndSelect('assignment.employee', 'employee')
      .leftJoinAndSelect('kpi.perspective', 'perspective')
      .leftJoinAndSelect('assignment.kpiValues', 'kpiValue') // Thêm join để có thể lọc theo section.department VÀ tải dữ liệu Department của Section
      .leftJoinAndSelect('section.department', 'departmentOfSection') // <-- Thêm join & select
      .where('kpi.deleted_at IS NULL') // Filter non-soft-deleted KPIs
      .andWhere('assignment.deleted_at IS NULL') // <-- Thêm lọc soft delete assignment
      .andWhere(
        // Lọc theo departmentId từ URL path
        new Brackets((qb) => {
          qb.where(
            // KPI được tạo bởi department này
            'kpi.created_by_type = :createdType AND kpi.created_by = :departmentIdFromPath',
            {
              createdType: 'department',
              departmentIdFromPath: departmentId,
            },
          ).orWhere(
            // Assignment gán trực tiếp cho department này
            'assignment.assigned_to_department = :departmentIdFromPath',
            {
              departmentIdFromPath: departmentId,
            },
          );
        }),
      ); // Áp dụng các bộ lọc tùy chọn từ filterDto

    if (filterDto.name) {
      query.andWhere('kpi.name ILIKE :name', {
        name: `%${filterDto.name}%`,
      });
    }

    if (filterDto.perspectiveId) {
      query.andWhere('kpi.perspective_id = :perspectiveId', {
        perspectiveId: filterDto.perspectiveId,
      });
    } // Logic lọc theo Section, Team, EmployeeId từ filterDto.
    // Lưu ý: filterDto.sectionId/teamId/assignedToId ở đây sẽ lọc assignment
    // bên trong department, không phải là filter chính như ở getSectionKpis

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
      // Assuming assignedToId filters employee assignments
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

    query.distinct(true); // Đảm bảo distinct
    // Xử lý sắp xếp

    const validSortColumns = ['name', 'created_at'];
    const sortBy = validSortColumns.includes(filterDto.sortBy ?? '')
      ? filterDto.sortBy!
      : 'created_at';
    const sortOrder = filterDto.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    query.orderBy(`kpi.${sortBy}`, sortOrder); // Áp dụng phân trang và lấy dữ liệu

    const [data, totalItems] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount(); // getManyAndCount tự động tính count cho query hiện tại
    // Tính toán actual_value (giữ nguyên logic hiện có)

    const dataWithActualValue = data.map((kpi) => {
      // Filter assignments in memory to only include non-soft-deleted ones,
      // although the query already filters assignment.deleted_at IS NULL
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
    }); // Xử lý phân trang

    const pagination = {
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit),
      totalItems,
      itemsPerPage: limit,
    };

    return { data: dataWithActualValue, pagination };
  } // Phương thức getAllKpiAssignedToDepartments (đã thêm join và lọc soft delete)

  async getAllKpiAssignedToDepartments(): Promise<Kpi[]> {
    return (
      this.kpisRepository
        .createQueryBuilder('kpi')
        .leftJoinAndSelect('kpi.perspective', 'perspective') // Load perspective (eager)
        .leftJoinAndSelect('kpi.assignments', 'assignment') // Load assignments (eager)
        // Load relations on assignment (eager)
        .leftJoinAndSelect('assignment.department', 'department')
        .leftJoinAndSelect('assignment.employee', 'employee')
        .leftJoinAndSelect('assignment.section', 'section')
        .leftJoinAndSelect('assignment.team', 'team')
        .leftJoinAndSelect('assignment.kpiValues', 'kpiValues') // Thêm join để có thể truy cập section.department
        .leftJoinAndSelect('section.department', 'departmentOfSection') // <-- Thêm join & select
        .where('assignment.assigned_to_department IS NOT NULL')
        .andWhere('assignment.deleted_at IS NULL') // <-- Thêm lọc soft delete assignment
        .andWhere('kpi.deleted_at IS NULL') // Filter non-soft-deleted KPIs
        .getMany()
    );
  } // Phương thức getAllKpiAssignedToSections (đã thêm join và lọc soft delete)

  async getAllKpiAssignedToSections(): Promise<Kpi[]> {
    return (
      this.kpisRepository
        .createQueryBuilder('kpi')
        .leftJoinAndSelect('kpi.perspective', 'perspective') // Load perspective (eager)
        .leftJoinAndSelect('kpi.assignments', 'assignment') // Load assignments (eager)
        // Load relations on assignment (eager)
        .leftJoinAndSelect('assignment.section', 'section')
        .leftJoinAndSelect('assignment.employee', 'employee')
        .leftJoinAndSelect('assignment.department', 'department')
        .leftJoinAndSelect('assignment.team', 'team')
        .leftJoinAndSelect('assignment.kpiValues', 'kpiValues') // Thêm join để có thể truy cập section.department
        .leftJoinAndSelect('section.department', 'departmentOfSection') // <-- Thêm join & select
        .where('assignment.assigned_to_section IS NOT NULL')
        .andWhere('assignment.deleted_at IS NULL') // <-- Thêm lọc soft delete assignment
        .andWhere('kpi.deleted_at IS NULL') // Filter non-soft-deleted KPIs
        .getMany()
    );
  } // Phương thức getSectionKpis (đã sửa đổi đầy đủ)

  async getSectionKpis(
    sectionIdParam: number | string, // Nhận tham số thông thường từ Controller
    filterDto: KpiFilterDto, // Nhận tham số thông thường từ Controller
  ): Promise<{
    data: (Kpi & { actual_value?: number })[]; // actual_value có thể là optional nếu tính toán sau
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
    };
  }> {
    // *** SỬอĐ ĐỔI CHÍNH Ở ĐÂY: Ép kiểu sectionId về number ***
    const sectionId = Number(sectionIdParam); // Đảm bảo sectionId là số cho các phép so sánh

    console.log('DEBUG SERVICE: เข้าสู่ getSectionKpis'); // <-- Log entry
    console.log(
      'DEBUG SERVICE: sectionId (converted number):',
      sectionId,
      typeof sectionId,
    ); // <-- Log giá trị đã ép kiểu và kiểu dữ liệu
    console.log('DEBUG SERVICE: filterDto (from query):', filterDto); // <-- Log filterDto
    console.log(
      'DEBUG SERVICE: filterDto.departmentId:',
      filterDto.departmentId,
      typeof filterDto.departmentId,
    ); // <-- Log departmentId và kiểu dữ liệu

    const { page = 1, limit = 15 } = filterDto;

    const query = this.kpisRepository
      .createQueryBuilder('kpi')
      .leftJoinAndSelect('kpi.assignments', 'assignment') // Tải assignments (eager on Kpi)
      // Load đầy đủ mối quan hệ của assignment (eager on KPIAssignment)
      .leftJoinAndSelect('assignment.department', 'department')
      .leftJoinAndSelect('assignment.section', 'section')
      .leftJoinAndSelect('assignment.team', 'team')
      .leftJoinAndSelect('assignment.employee', 'employee') // *** Dùng leftJoinAndSelect để tải Department thông qua Section ***
      .leftJoinAndSelect('section.department', 'departmentOfSection') // Tải Department của Section, dùng alias departmentOfSection
      .leftJoinAndSelect('kpi.perspective', 'perspective') // Load Perspective của KPI (eager on Kpi)
      .leftJoinAndSelect('assignment.kpiValues', 'kpiValue') // Tải KpiValue của assignment
      .where('kpi.deleted_at IS NULL') // Giữ điều kiện lọc soft delete cho KPI
      .andWhere('assignment.deleted_at IS NULL'); // Giữ điều kiện lọc soft delete cho Assignment
    // --- Handle the main Assignment/Creation filter logic based on sectionId (now number) and departmentId ---
    // *** Điều kiện if/else sẽ hoạt động đúng với sectionId là number ***

    if (sectionId === 0) {
      // *** KIỂM TRA sectionId === 0 TRƯỚC (sectionId giờ là number) ***
      console.log(
        'DEBUG SERVICE: เข้าสู่เงื่อนไข sectionId === 0 (All Sections)',
      ); // <-- Log condition hit
      if (filterDto.departmentId) {
        console.log(
          'DEBUG SERVICE: เข้าสู่เงื่อนไข filterDto.departmentId (All Sections trong Department)',
        ); // <-- Log condition hit
        // Lọc "All Sections" trong một Department cụ thể (filterDto.departmentId có giá trị)
        // *** CONSTRUCT RAW SQL STRING FOR THE COMPLEX OR CLAUSE ***
        const departmentAllFilterSql = `(kpi.created_by_type = :createdTypeDept AND kpi.created_by = :departmentIdFromFilter) OR (assignment.assigned_to_department = :departmentIdFromFilter) OR (assignment.assigned_to_section IS NOT NULL AND departmentOfSection.id = :departmentIdFromFilter)`;
        console.log('DEBUG SERVICE: raw SQL string:', departmentAllFilterSql); // <-- Log the raw SQL string
        console.log('DEBUG SERVICE: raw SQL parameters:', {
          createdTypeDept: 'department',
          departmentIdFromFilter: filterDto.departmentId,
        }); // <-- Log raw SQL parameters
        // Add the raw SQL clause to the query with parameters.
        // TypeORM will parse the parameter names within the string and bind the object.

        query.andWhere(departmentAllFilterSql, {
          createdTypeDept: 'department',
          departmentIdFromFilter: filterDto.departmentId,
        });
      } else {
        console.log(
          'DEBUG SERVICE: เข้าสู่เงื่อนไข else (All Sections toànโลก, khôngมี filterDto.departmentId)',
        ); // <-- Log condition hit
        // Lọc "All Sections" toàn cầu (không có filterDto.departmentId)
        // Chỉ cần lọc assignment được gán cho bất kỳ Section nào
        query.andWhere('assignment.assigned_to_section IS NOT NULL'); // Sử dụng Query Builder
        // No parameter needed here
      }
    } else {
      // sectionId !== 0
      console.log(
        'DEBUG SERVICE: เข้าสู่เงื่อนไข sectionId !== 0 (Section cụเฉพาะ)',
      ); // <-- Log condition hit
      // Case: Specific section filter (sectionId from URL path NOT 0)
      // Sử dụng Query Builder Brackets cho OR conditions
      query.andWhere(
        new Brackets((qb) => {
          qb.where(
            '(kpi.created_by_type = :createdTypeSection AND kpi.created_by = :sectionIdFromPath)',
            { createdTypeSection: 'section', sectionIdFromPath: sectionId }, // Explicit params
          );
          qb.orWhere(
            'assignment.assigned_to_section = :sectionIdFromPath',
            { sectionIdFromPath: sectionId }, // Explicit params
          );
        }),
      );
    } // Kết thúc if/else cho sectionId
    // --- Áp dụng các điều kiện lọc khác từ filterDto (AND conditions) ---

    console.log('DEBUG SERVICE: Applying other filters...'); // <-- Log before other filters
    if (filterDto.name) {
      console.log('DEBUG SERVICE: Applying name filter:', filterDto.name); // <-- Log specific filter
      query.andWhere('kpi.name ILIKE :name', { name: `%${filterDto.name}%` });
    }
    if (filterDto.perspectiveId) {
      console.log(
        'DEBUG SERVICE: Applying perspectiveId filter:',
        filterDto.perspectiveId,
      ); // <-- Log specific filter
      query.andWhere('kpi.perspective_id = :perspectiveId', {
        perspectiveId: filterDto.perspectiveId,
      });
    }
    if (filterDto.teamId) {
      console.log('DEBUG SERVICE: Applying teamId filter:', filterDto.teamId); // <-- Log specific filter
      query.andWhere('assignment.assigned_to_team = :teamId', {
        teamId: filterDto.teamId,
      });
    }
    if (filterDto.status) {
      console.log('DEBUG SERVICE: Applying status filter:', filterDto.status); // <-- Log specific filter
      query.andWhere('kpi.status = :status', { status: filterDto.status });
    }
    if (filterDto.startDate) {
      console.log(
        'DEBUG SERVICE: Applying startDate filter:',
        filterDto.startDate,
      ); // <-- Log specific filter
      query.andWhere('kpi.start_date >= :startDate', {
        startDate: filterDto.startDate,
      });
    }
    if (filterDto.endDate) {
      console.log('DEBUG SERVICE: Applying endDate filter:', filterDto.endDate); // <-- Log specific filter
      query.andWhere('kpi.end_date <= :endDate', {
        endDate: filterDto.endDate,
      });
    }

    query.distinct(true); // Ensures distinct KPIs

    console.log('DEBUG SERVICE: Executing query...'); // <-- Log before execution
    // --- Execute query, map results, handle pagination ---

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

    console.log(
      'DEBUG SERVICE: Query executed, data length:',
      data.length,
      'totalItems:',
      totalItems,
    ); // <-- Log results summary
    // --- Tính toán actual_value (giữ nguyên logic) ---

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

    console.log('DEBUG SERVICE: Returning data and pagination'); // <-- Log exit

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
    // Load assignments for a specific KPI, filtering out soft-deleted ones
    const assignments = await this.kpiAssignmentRepository.find({
      where: { kpi_id: kpiId, deleted_at: IsNull() }, // Chỉ lọc các bản ghi KHÔNG bị soft delete
      withDeleted: true, // <-- Giữ nguyên (cho phép truy vấn cả bản đã xóa nếu cần logic khác), nhưng WHERE đã lọc rồi
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
          console.log('create service: Incoming createKpiDto:', createKpiDto); // <-- LOG 1: Payload nhận được
          const dto = plainToInstance(CreateKpiDto, createKpiDto);
          console.log('create service: PlainToInstance DTO:', dto); // <-- LOG 2: DTO sau plainToInstance
          const { assignments, id, ...kpiData } = dto as any;

          console.log('create service: Extracted assignments:', assignments); // <-- LOG 3: Đối tượng assignments trích xuất
          let createdByType = 'company'; // Lấy ID employee từ phần assignments trong payload (nếu có)
          const assignedToEmployeeId = assignments?.employeeId;
          console.log(
            'create service: AssignedToEmployeeId after extraction:',
            assignedToEmployeeId,
          ); // <-- LOG 4: Giá trị assignedToEmployeeId

          if (assignedToEmployeeId) {
            createdByType = 'employee'; // Nếu có employeeId, đây là KPI cá nhân
          } else if (
            assignments?.toSections &&
            assignments.toSections.length > 0
          ) {
            createdByType = 'section'; // Nếu có assignment cho section
          } else if (
            assignments?.toDepartments &&
            assignments.toDepartments.length > 0
          ) {
            createdByType = 'department'; // Nếu có assignment cho department
          } // Các loại khác (ví dụ: company level without specific assignments) vẫn giữ mặc định 'company'
          console.log(
            'create service: Determined createdByType:',
            createdByType,
          ); // <-- LOG 5: Kết quả xác định createdByType
          // TODO: Lấy ID người dùng thực hiện thao tác tạo từ JWT

          const assignedByUserId = 1; // Thay bằng ID người dùng thực tế
          // Tạo entity Kpi mới
          const kpi = manager.getRepository(Kpi).create({
            ...kpiData, // Copy các thuộc tính KPI từ DTO
            // Ánh xạ các trường DTO sang entity (nếu tên khác nhau)
            min_target: kpiData.minimum,
            mid_target: kpiData.middle,
            max_target: kpiData.maximum,
            calculation_type: kpiData.calculationType,
            perspective_id: kpiData.perspectiveId,
            start_date: kpiData.startDate,
            end_date: kpiData.endDate,
            memo: kpiData.description, // Giả định memo map từ description
            // Thiết lập created_by và created_by_type
            created_by:
              createdByType === 'employee'
                ? assignedToEmployeeId
                : createdByType === 'section' &&
                    assignments?.toSections?.[0]?.id
                  ? assignments.toSections[0].id
                  : createdByType === 'department' &&
                      assignments?.toDepartments?.[0]?.id
                    ? assignments.toDepartments[0].id
                    : assignedByUserId || 1, // Fallback to assignedByUserId or 1
            created_by_type: createdByType,
            created_at: new Date(), // Thiết lập thời gian tạo
            updated_at: new Date(), // Thiết lập thời gian cập nhật
          }); // Lưu entity Kpi vào database để có ID

          const savedKpi = (await manager
            .getRepository(Kpi)
            .save(kpi)) as unknown as Kpi;

          const assignmentEntities: KPIAssignment[] = []; // Danh sách các assignment cần tạo
          // Xử lý assignment cho Department
          if (assignments?.toDepartments) {
            for (const targetDepartment of assignments.toDepartments) {
              const assignment = new KPIAssignment();
              assignment.kpi = savedKpi; // Liên kết với KPI vừa tạo
              assignment.assignedFrom = assignments?.from || createdByType; // Từ đâu gán
              assignment.assigned_to_department = targetDepartment.id; // Gán cho Department ID
              // Lấy targetValue từ dữ liệu assignment cụ thể hoặc từ KPIData nếu không có
              assignment.targetValue =
                Number(targetDepartment.target) ?? Number(kpiData.target); // Weight? Giả định weight không set ở đây cho Dept, lấy từ KPI hoặc null

              assignment.assignedBy = assignedByUserId; // ID người tạo assignment
              assignment.status = 'draft'; // Trạng thái ban đầu

              assignmentEntities.push(assignment);
            }
          } // Xử lý assignment cho Section

          if (assignments?.toSections) {
            for (const targetSection of assignments.toSections) {
              const assignment = new KPIAssignment();
              assignment.kpi = savedKpi; // Liên kết với KPI vừa tạo
              assignment.assignedFrom = assignments?.from || createdByType; // Từ đâu gán
              assignment.assigned_to_section = targetSection.id; // Gán cho Section ID
              // Lấy targetValue từ dữ liệu assignment cụ thể hoặc từ KPIData nếu không có
              assignment.targetValue =
                Number(targetSection.target) ?? Number(kpiData.target); // Weight?

              assignment.assignedBy = assignedByUserId; // ID người tạo assignment
              assignment.status = 'draft'; // Trạng thái ban đầu

              assignmentEntities.push(assignment);
            }
          } // Xử lý assignment cho Employee (KPI cá nhân)

          if (assignedToEmployeeId) {
            // Chỉ tạo nếu có employeeId trong payload
            const employeeAssignment = new KPIAssignment();
            employeeAssignment.kpi = savedKpi; // Liên kết với KPI vừa tạo
            employeeAssignment.assignedFrom =
              assignments?.from || createdByType; // Từ đâu gán (employee)
            employeeAssignment.assigned_to_employee = assignedToEmployeeId; // Gán cho employee ID từ payload
            employeeAssignment.employee_id = assignedToEmployeeId; // Giữ cột này theo entity
            // Lấy target và weight từ KPIData cho assignment cá nhân
            employeeAssignment.targetValue = Number(kpiData.target);

            employeeAssignment.assignedBy = assignedByUserId; // ID người tạo assignment
            employeeAssignment.status = 'draft'; // Trạng thái ban đầu

            assignmentEntities.push(employeeAssignment);
          } // Lưu tất cả assignments đã tạo (Department, Section, Employee)

          if (assignmentEntities.length > 0) {
            await manager.getRepository(KPIAssignment).save(assignmentEntities);
          }

          return savedKpi; // Trả về KPI đã lưu
        } catch (error) {
          console.error('Transaction failed:', error); // Rollback transaction tự động khi throw error
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
    assignments: { user_id: number; target: number; weight?: number }[], // Danh sách user ID và target từ frontend
  ): Promise<KPIAssignment[]> {
    // Xóa dòng xóa toàn bộ assignment cũ ở đây (nếu còn)

    // Fetch KPI gốc để lấy created_by_type và weight
    const kpi = await this.kpisRepository.findOne({ where: { id: kpiId } });
    if (!kpi) {
      throw new NotFoundException(`KPI with ID ${kpiId} not found`);
    } // TODO: Lấy assignedById từ người dùng hiện tại (JWT)
    const assignedById = 1; // Thay bằng ID người dùng thực tế
    const assignedFromType = kpi.created_by_type;
    const kpiWeight = kpi.weight; // Weight lấy từ KPI
    // Fetch TẤT CẢ existing user assignments cho KPI này (bao gồm cả soft deleted)
    // Chúng ta cần check cả soft deleted để tránh insert lại assignment đã soft deleted
    const allExistingUserAssignmentsIncludingSoftDeleted =
      await this.kpiAssignmentRepository.find({
        where: { kpi_id: kpiId, assigned_to_employee: Not(IsNull()) },
        withDeleted: true, // <-- Giữ nguyên (cho phép truy vấn cả bản đã xóa nếu cần logic khác), nhưng WHERE đã lọc rồi
        relations: ['employee'], // Load relation employee nếu cần
      }); // Tạo map để dễ dàng tìm assignment hiện có theo user_id

    const existingAssignmentsMap = new Map<number, KPIAssignment>();
    allExistingUserAssignmentsIncludingSoftDeleted.forEach((assignment) => {
      if (assignment.assigned_to_employee !== null) {
        existingAssignmentsMap.set(assignment.assigned_to_employee, assignment);
      }
    });

    const assignmentsToInsert: KPIAssignment[] = []; // Danh sách các assignment cần thêm mới
    const assignmentsToSave: KPIAssignment[] = []; // Danh sách các assignment cần save (bao gồm cả insert và update/restore)
    // Lặp qua danh sách assignments gửi lên từ frontend
    for (const incomingAssignment of assignments) {
      const existingAssignment = existingAssignmentsMap.get(
        incomingAssignment.user_id,
      );

      if (existingAssignment) {
        // Nếu assignment cho user này đã tồn tại (bao gồm cả trường hợp soft deleted)
        // Cập nhật targetValue, weight (từ KPI), status (nếu cần), và xóa soft delete
        existingAssignment.targetValue = incomingAssignment.target;
        existingAssignment.updated_at = new Date();
        existingAssignment.deleted_at = null as any; // <<< RẤT QUAN TRỌNG: Khôi phục bản ghi đã soft delete >>>
        // Thêm vào danh sách cần save (sẽ là update và restore)
        assignmentsToSave.push(existingAssignment);
      } else {
        // Nếu assignment cho user này CHƯA tồn tại, tạo mới
        const newAssignment = this.kpiAssignmentRepository.create(
          {
            kpi: { id: kpiId }, // Liên kết assignment với KPI
            assigned_to_employee: incomingAssignment.user_id,
            employee_id: incomingAssignment.user_id, // Giữ cột này theo entity
            targetValue: incomingAssignment.target,
            weight: kpiWeight, // Lấy weight từ KPI
            status: 'draft', // Trạng thái ban đầu cho assignment mới
            assignedFrom: assignedFromType, // Từ loại đơn vị tạo KPI
            assignedBy: assignedById, // ID người dùng thực hiện thao tác
            created_at: new Date(),
            updated_at: new Date(), // Đảm bảo các trường assigned_to khác là null cho assignment user
            assigned_to_department: null,
            assigned_to_section: null,
            assigned_to_team: null,
          } as unknown as import('typeorm').DeepPartial<KPIAssignment>, // Áp dụng double assertion
        ); // Thêm vào danh sách cần save (sẽ là insert)
        assignmentsToSave.push(newAssignment);
      }
    } // <<< LOẠI BỎ TOÀN BỘ LOGIC SOFT DELETE >>>
    // Không tính toán assignmentsToDelete, không gọi manager.softRemove
    // Thực hiện các thao tác save trong một transaction
    await this.kpiAssignmentRepository.manager.transaction(async (manager) => {
      // Save tất cả assignment cần insert hoặc update/restore
      if (assignmentsToSave.length > 0) {
        await manager.save(
          KPIAssignment,
          assignmentsToSave as unknown as KPIAssignment[], // Áp dụng double assertion
        );
      }
    }); // Lấy lại danh sách assignment (chỉ non-deleted) sau khi save để trả về
    // Hàm getKpiAssignments đã có điều kiện deleted_at: IsNull()
    const updatedAssignmentsList = await this.getKpiAssignments(kpiId);

    return updatedAssignmentsList; // Trả về danh sách assignment non-deleted
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
