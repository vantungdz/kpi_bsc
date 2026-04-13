import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  In,
  IsNull,
  Not,
  Repository,
} from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Kpi } from '../entities/kpi.entity';
import { KPIAssignment } from '../../kpi-assessments/entities/kpi-assignment.entity';
import { Employee } from '../../employees/entities/employee.entity';
import { Section } from '../../sections/entities/section.entity';
import { userHasPermission } from '../../common/utils/permission.utils';
import { EmployeesService } from '../../employees/employees.service';
import { NotificationService } from '../../notification/notification.service';
import { getKpiStatus } from '../kpis.service';

@Injectable()
export class KpiAssignmentService {
  private readonly logger = new Logger(KpiAssignmentService.name);

  constructor(
    private dataSource: DataSource,
    @InjectRepository(Kpi)
    private readonly kpisRepository: Repository<Kpi>,
    @InjectRepository(KPIAssignment)
    private readonly kpiAssignmentRepository: Repository<KPIAssignment>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    private eventEmitter: EventEmitter2,
    private employeesService: EmployeesService,
    private notificationService: NotificationService,
  ) {}

  /**
   * Save user-level KPI assignments with permission checks and hierarchical validation.
   * Supports create, update, and restore of soft-deleted assignments.
   */
  async saveUserAssignments(
    kpiId: number,
    assignments: { user_id: number; target: number; weight?: number }[],
    loggedInUser: Employee,
    contextDepartmentId?: number,
  ): Promise<KPIAssignment[]> {
    if (!Array.isArray(assignments) || assignments.length === 0) {
      throw new BadRequestException('Assignments array is empty or invalid');
    }
    const kpi = await this.kpisRepository.findOne({ where: { id: kpiId } });
    if (!kpi) {
      throw new NotFoundException(`KPI with ID ${kpiId} not found`);
    }

    // Check if KPI has expired
    const kpiValidityStatus = getKpiStatus(kpi.start_date, kpi.end_date);
    if (kpiValidityStatus === 'expired') {
      throw new BadRequestException(
        'Cannot assign expired KPI to other employees. This KPI is no longer valid.',
      );
    }
    const assignedById = loggedInUser.id;
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

    const assignmentsToSave: KPIAssignment[] = [];

    for (const incomingAssignment of assignments) {
      // Check user permissions with proper scope hierarchy
      const hasCompanyPermission = userHasPermission(
        loggedInUser,
        'assign',
        'kpi',
        'company',
      );
      const hasDepartmentPermission = userHasPermission(
        loggedInUser,
        'assign',
        'kpi',
        'department',
      );
      const hasSectionPermission = userHasPermission(
        loggedInUser,
        'assign',
        'kpi',
        'section',
      );

      if (
        !hasCompanyPermission &&
        !hasDepartmentPermission &&
        !hasSectionPermission
      ) {
        throw new UnauthorizedException(
          'You do not have permission to assign KPIs.',
        );
      }

      // If user only has section permission, validate section assignment
      if (
        hasSectionPermission &&
        !hasDepartmentPermission &&
        !hasCompanyPermission
      ) {
        if (!loggedInUser.sectionId) {
          throw new UnauthorizedException(
            'You are not assigned to a section and cannot assign KPIs.',
          );
        }
        const employeeToAssign = await this.employeeRepository.findOne({
          where: {
            id: incomingAssignment.user_id,
            sectionId: loggedInUser.sectionId,
          },
        });
        if (!employeeToAssign) {
          throw new UnauthorizedException(
            `You can only assign KPIs to employees within your own section. User ID ${incomingAssignment.user_id} is not in your section or does not exist.`,
          );
        }
      }

      // If user has department permission (but not company), validate department assignment
      if (hasDepartmentPermission && !hasCompanyPermission) {
        if (!loggedInUser.departmentId) {
          throw new UnauthorizedException(
            'You are not assigned to a department and cannot assign KPIs.',
          );
        }
        const employeeToAssign = await this.employeeRepository.findOne({
          where: {
            id: incomingAssignment.user_id,
          },
          relations: ['section', 'section.department'],
        });
        if (
          !employeeToAssign ||
          employeeToAssign.section?.department?.id !== loggedInUser.departmentId
        ) {
          throw new UnauthorizedException(
            `You can only assign KPIs to employees within your department. User ID ${incomingAssignment.user_id} is not in your department or does not exist.`,
          );
        }
      }

      // If user has company permission, no additional validation needed (can assign to anyone)

      const existingAssignment = existingAssignmentsMap.get(
        incomingAssignment.user_id,
      );

      if (existingAssignment) {
        // Check if KPI has expired when updating existing assignment
        const kpiValidityStatus = getKpiStatus(kpi.start_date, kpi.end_date);
        if (kpiValidityStatus === 'expired') {
          throw new BadRequestException(
            'Cannot update target value for expired KPI. This KPI is no longer valid.',
          );
        }

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
          status: kpi.status,
          assignedFrom: assignedFromType,
          assignedBy: assignedById,
          created_at: new Date(),
          updated_at: new Date(),
          assigned_to_department: null,
          assigned_to_section: null,
          assigned_to_team: null,
          start_date: kpi.start_date,
          end_date: kpi.end_date,
        } as unknown as import('typeorm').DeepPartial<KPIAssignment>);
        assignmentsToSave.push(newAssignment);

        if (newAssignment.assigned_to_employee) {
          this.eventEmitter.emit('kpi.assigned', {
            assignment: newAssignment,
            kpiName: kpi.name,
          });
        }
      }
    }

    await this.kpiAssignmentRepository.manager.transaction(async (manager) => {
      if (assignmentsToSave.length > 0) {
        // Hierarchical Validation
        const validationPayload = assignmentsToSave.map((a) => ({
          assignmentId: a.id,
          targetValue: Number(a.targetValue),
          assigned_to_employee: a.assigned_to_employee,
          assigned_to_department: a.assigned_to_department,
          assigned_to_section: a.assigned_to_section,
        }));
        await this.validateHierarchyAndTotal(
          kpiId,
          validationPayload,
          manager,
          contextDepartmentId,
        );

        await manager.save(
          KPIAssignment,
          assignmentsToSave as unknown as KPIAssignment[],
        );
      }
    });

    const updatedAssignmentsList = await this.kpiAssignmentRepository.find({
      where: { kpi_id: kpiId },
      relations: ['employee'],
    });
    return updatedAssignmentsList;
  }

  /**
   * Soft-delete a section assignment by KPI ID and section ID.
   */
  async deleteSectionAssignment(
    kpiId: number,
    sectionId: number,
  ): Promise<void> {
    const assignment = await this.kpiAssignmentRepository.findOne({
      where: { kpi_id: kpiId, assigned_to_section: sectionId },
      relations: ['kpi'],
    });
    if (!assignment) {
      throw new NotFoundException(
        `Section Assignment with KPI ID ${kpiId} and Section ID ${sectionId} not found`,
      );
    }
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

  /**
   * Save department and section-level KPI assignments with hierarchical validation.
   * When both department and section are provided, only creates section assignment.
   */
  async saveDepartmentAndSectionAssignments(
    kpiId: number,
    assignmentsData: {
      assigned_to_department?: number | null;
      assigned_to_section?: number | null;
      targetValue: number;
      assignmentId?: number | null;
    }[],
    userId: number,
  ): Promise<void> {
    if (!Array.isArray(assignmentsData) || assignmentsData.length === 0) {
      throw new BadRequestException('Assignments array is empty or invalid');
    }
    const assignmentRepo = this.dataSource.getRepository(KPIAssignment);

    return await this.dataSource.transaction(async (manager) => {
      const kpiRepo = manager.getRepository(Kpi);
      const kpi = await kpiRepo.findOneBy({ id: kpiId });
      if (!kpi) {
        throw new NotFoundException(`KPI with ID ${kpiId} not found`);
      }

      // Check if KPI has expired
      const kpiValidityStatus = getKpiStatus(kpi.start_date, kpi.end_date);
      if (kpiValidityStatus === 'expired') {
        throw new BadRequestException(
          'Cannot assign expired KPI to other departments/sections. This KPI is no longer valid.',
        );
      }

      // Hierarchical Validation
      await this.validateHierarchyAndTotal(kpiId, assignmentsData, manager);

      const entitiesToSave: KPIAssignment[] = [];

      for (const assignmentData of assignmentsData) {
        if (assignmentData.assignmentId) {
          try {
            const existingAssignment = await assignmentRepo.findOneByOrFail({
              id: assignmentData.assignmentId,
            });

            // Check if KPI has expired when updating existing assignment
            const kpiValidityStatus = getKpiStatus(
              kpi.start_date,
              kpi.end_date,
            );
            if (kpiValidityStatus === 'expired') {
              throw new BadRequestException(
                'Cannot update target value for expired KPI. This KPI is no longer valid.',
              );
            }

            existingAssignment.targetValue = assignmentData.targetValue;
            existingAssignment.updated_at = new Date();
            entitiesToSave.push(existingAssignment);
          } catch (error) {
            if (error.name === 'EntityNotFoundError') {
              continue;
            } else {
              throw error;
            }
          }
        } else {
          if (
            !assignmentData.assigned_to_department &&
            !assignmentData.assigned_to_section
          ) {
            throw new BadRequestException(
              'Assignment target (Department or Section) is required for new assignments.',
            );
          }

          // When both department and section are provided, only create section assignment
          // The section assignment includes the department ID for reference
          const newAssignment = assignmentRepo.create({
            kpi: { id: kpiId } as Kpi,
            assignedFrom: kpi.created_by_type,
            assignedBy: userId,
            targetValue: assignmentData.targetValue,
            status: kpi.status,
            assigned_to_department: assignmentData.assigned_to_section
              ? assignmentData.assigned_to_department
              : assignmentData.assigned_to_department || null,
            assigned_to_section: assignmentData.assigned_to_section || null,
            assigned_to_team: null,
            assigned_to_employee: null,
            employee_id: null,
            startDate: kpi.start_date,
            endDate: kpi.end_date,
            created_at: new Date(),
            updated_at: new Date(),
            assignedAt: new Date(),
          } as DeepPartial<KPIAssignment>);
          entitiesToSave.push(newAssignment);
        }
      }

      if (entitiesToSave.length > 0) {
        await assignmentRepo.save(entitiesToSave);
      }
    });
  }

  /**
   * Validates strict hierarchical target constraints:
   * 1. Effective Total Assigned <= KPI Target
   * 2. Sum(Section Targets for Dept) <= Department Target
   * 3. Sum(User Targets for Section) <= Section Target
   */
  private async validateHierarchyAndTotal(
    kpiId: number,
    incomingAssignments: {
      assignmentId?: number | null;
      assigned_to_department?: number | null;
      assigned_to_section?: number | null;
      assigned_to_employee?: number | null;
      employee_id?: number | null;
      targetValue: number;
    }[],
    manager?: EntityManager,
    contextDepartmentId?: number,
  ): Promise<void> {
    const kpiRepo = manager ? manager.getRepository(Kpi) : this.kpisRepository;
    const assignmentRepo = manager
      ? manager.getRepository(KPIAssignment)
      : this.kpiAssignmentRepository;
    const empRepo = manager
      ? manager.getRepository(Employee)
      : this.employeeRepository;

    const kpi = await kpiRepo.findOne({ where: { id: kpiId } });
    if (!kpi || kpi.target === null || kpi.target === undefined) return;

    // Fetch ALL existing assignments for this KPI
    const existingAssignments = await assignmentRepo.find({
      where: { kpi: { id: kpiId }, deleted_at: IsNull() },
      relations: [
        'employee',
        'employee.section',
        'employee.section.department',
        'section',
        'section.department',
        'department',
      ],
    });

    // Merge Existing and Incoming assignments
    const mergedAssignments: any[] = [];
    const incomingIds = new Set<number>();
    incomingAssignments.forEach((inc) => {
      if (inc.assignmentId) incomingIds.add(inc.assignmentId);
    });

    // 1. Add existing assignments (excluding those being updated)
    for (const ex of existingAssignments) {
      if (!incomingIds.has(ex.id)) {
        let deptId = ex.assigned_to_department;

        // For section assignments, if deptId is not set, get it from section object
        if (ex.assigned_to_section && !deptId && ex.section) {
          deptId = ex.section.department?.id || null;
        }

        mergedAssignments.push({
          type: ex.assigned_to_employee
            ? 'user'
            : ex.assigned_to_section
              ? 'section'
              : 'department',
          id: ex.id,
          targetValue: Number(ex.targetValue || 0),
          deptId: deptId,
          sectId: ex.assigned_to_section,
          userId: ex.assigned_to_employee,
          // user hierarchy fallback from employee relation
          userSectId: ex.employee?.sectionId || ex.employee?.section?.id,
          userDeptId:
            ex.employee?.departmentId || ex.employee?.section?.department?.id,
        });
      }
    }

    // 2. Add/Update incoming assignments
    // Pre-fetch employee info for incoming USER assignments to know their Section/Dept
    const incomingUserIds = incomingAssignments
      .filter((a) => a.assigned_to_employee || a.employee_id)
      .map((a) => a.assigned_to_employee || a.employee_id);

    const userMap = new Map<number, Employee>();
    if (incomingUserIds.length > 0) {
      const users = await empRepo.find({
        where: { id: In(incomingUserIds) },
        relations: ['section', 'section.department'],
      });
      users.forEach((u) => userMap.set(u.id, u));
    }

    // Pre-fetch section info for incoming SECTION assignments to know their Department
    const incomingSectionIds = incomingAssignments
      .filter((a) => a.assigned_to_section)
      .map((a) => a.assigned_to_section);

    const sectionRepo = manager
      ? manager.getRepository(Section)
      : this.dataSource.getRepository(Section);
    const sectionMap = new Map<number, Section>();
    if (incomingSectionIds.length > 0) {
      const sections = await sectionRepo.find({
        where: { id: In(incomingSectionIds) },
        relations: ['department'],
      });
      sections.forEach((s) => sectionMap.set(s.id, s));
    }

    for (const inc of incomingAssignments) {
      const userId = inc.assigned_to_employee || inc.employee_id;
      let type = 'department';
      if (userId) type = 'user';
      else if (inc.assigned_to_section) type = 'section';

      let userSectId: number | null | undefined = null;
      let userDeptId: number | null | undefined = null;

      let deptId = inc.assigned_to_department ?? null;
      let sectId = inc.assigned_to_section ?? null;

      // For section assignments, if deptId is not provided, get it from section
      if (type === 'section' && sectId && !deptId) {
        const section = sectionMap.get(sectId);
        if (section) {
          deptId = section.department?.id || null;
        }
      }

      if (type === 'user' && userId) {
        const u = userMap.get(userId);
        if (u) {
          userSectId = u.sectionId || u.section?.id;
          userDeptId = u.departmentId || u.section?.department?.id;
        }
      }

      mergedAssignments.push({
        type,
        id: inc.assignmentId || -1, // placeholder for new
        targetValue: Number(inc.targetValue || 0),
        deptId: deptId,
        sectId: sectId,
        userId: userId,
        userSectId,
        userDeptId,
      });
    }

    // --- Validation Logic ---

    // A. Validate KPI Total (Effective Sum)
    const kpiTarget = Number(kpi.target);
    const assignedDeptIds = new Set<number>();
    mergedAssignments
      .filter((a) => a.type === 'department')
      .forEach((a) => {
        if (a.deptId) assignedDeptIds.add(a.deptId);
      });

    const assignedSectIds = new Set<number>();
    mergedAssignments
      .filter((a) => a.type === 'section')
      .forEach((a) => {
        if (a.sectId) assignedSectIds.add(a.sectId);
      });

    let effectiveTotal = 0;

    for (const a of mergedAssignments) {
      if (a.type === 'department') {
        effectiveTotal += a.targetValue;
      } else if (a.type === 'section') {
        // Add if Dept NOT assigned
        if (a.deptId && !assignedDeptIds.has(a.deptId)) {
          effectiveTotal += a.targetValue;
        }
      } else if (a.type === 'user') {
        // Add if Section NOT assigned AND Dept NOT assigned
        const coveredBySect = a.userSectId && assignedSectIds.has(a.userSectId);
        const coveredByDept = a.userDeptId && assignedDeptIds.has(a.userDeptId);

        if (!coveredBySect && !coveredByDept) {
          effectiveTotal += a.targetValue;
        }
      }
    }

    // Skip KPI-level validation if we're in a department context
    if (!contextDepartmentId && effectiveTotal > kpiTarget) {
      throw new BadRequestException(
        `ERR_KPI_TARGET_EXCEEDED:${effectiveTotal}:${kpiTarget}`,
      );
    }

    // B. Sub-unit (Section + Direct User) Targets <= Department Target
    const deptMap = new Map<number, number>(); // DeptID -> Target
    mergedAssignments
      .filter((a) => a.type === 'department')
      .forEach((a) => deptMap.set(a.deptId, a.targetValue));

    const deptConsumed = new Map<number, number>();

    // 1. Add Section Targets to Dept
    mergedAssignments
      .filter((a) => a.type === 'section')
      .forEach((a) => {
        if (a.deptId) {
          const current = deptConsumed.get(a.deptId) || 0;
          deptConsumed.set(a.deptId, current + a.targetValue);
        }
      });

    // 2. Add Direct/Exposed User Targets to Dept
    // (Users not covered by an assigned Section)
    mergedAssignments
      .filter((a) => a.type === 'user')
      .forEach((a) => {
        if (a.userDeptId) {
          const isCoveredBySection =
            a.userSectId && assignedSectIds.has(a.userSectId);
          if (!isCoveredBySection) {
            const current = deptConsumed.get(a.userDeptId) || 0;
            deptConsumed.set(a.userDeptId, current + a.targetValue);
          }
        }
      });

    for (const [dId, dTarget] of deptMap.entries()) {
      const totalConsumed = deptConsumed.get(dId) || 0;
      if (totalConsumed > dTarget) {
        throw new BadRequestException(
          `ERR_DEPT_TARGET_EXCEEDED:${dId}:${totalConsumed}:${dTarget}`,
        );
      }
    }

    // C. User Targets <= Section Target
    const sectMap = new Map<number, number>(); // SectID -> Target
    mergedAssignments
      .filter((a) => a.type === 'section')
      .forEach((a) => sectMap.set(a.sectId, a.targetValue));

    const userTotalBySect = new Map<number, number>();
    mergedAssignments
      .filter((a) => a.type === 'user')
      .forEach((a) => {
        if (a.userSectId) {
          const current = userTotalBySect.get(a.userSectId) || 0;
          userTotalBySect.set(a.userSectId, current + a.targetValue);
        }
      });

    for (const [sId, sTarget] of sectMap.entries()) {
      const userTotal = userTotalBySect.get(sId) || 0;
      if (userTotal > sTarget) {
        throw new BadRequestException(
          `ERR_SECTION_TARGET_EXCEEDED:${sId}:${userTotal}:${sTarget}`,
        );
      }
    }
  }
}
