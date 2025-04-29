import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, DeepPartial, Brackets } from 'typeorm';
import { KpiValue, KpiValueStatus } from '../entities/kpi-value.entity';
import { KpiValueHistory } from 'src/entities/kpi-value-history.entity';
import { KPIAssignment } from 'src/entities/kpi-assignment.entity';
import { Employee } from 'src/entities/employee.entity';

@Injectable()
export class KpiValuesService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(KpiValue)
    private kpiValuesRepository: Repository<KpiValue>,
    @InjectRepository(KpiValueHistory)
    private kpiValueHistoryRepository: Repository<KpiValueHistory>,
    @InjectRepository(KPIAssignment)
    private readonly kpiAssignmentRepository: Repository<KPIAssignment>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
  ) {}

  async findAll(): Promise<KpiValue[]> {
    return await this.kpiValuesRepository.find({});
  }

  async findOne(id: number): Promise<KpiValue> {
    const data = await this.kpiValuesRepository.findOne({
      where: { id },
    });

    if (!data) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return data;
  }

  async create(
    kpiValueData: Partial<KpiValue>,
    createdBy: number,
  ): Promise<KpiValue> {
    const newKpiValue = this.kpiValuesRepository.create(kpiValueData);
    const savedKpiValue = await this.kpiValuesRepository.save(newKpiValue);

    const historyEntry = this.kpiValueHistoryRepository.create({
      kpi_value_id: savedKpiValue.id,

      value: savedKpiValue.value,
      timestamp: savedKpiValue.timestamp,
      notes: savedKpiValue.notes,
      action: 'CREATE',
      changed_by: createdBy,
    });
    await this.kpiValueHistoryRepository.save(historyEntry);

    return savedKpiValue;
  }

  async update(
    id: number,
    updateData: Partial<KpiValue>,
    updatedBy: number,
  ): Promise<KpiValue> {
    const kpiValue = await this.kpiValuesRepository.findOne({
      where: { id },
    });
    if (!kpiValue) {
      throw new NotFoundException(`KPI Value with ID ${id} not found`);
    }

    const historyEntry = this.kpiValueHistoryRepository.create({
      kpi_value_id: kpiValue.id,

      value: kpiValue.value,
      timestamp: kpiValue.timestamp,
      notes: kpiValue.notes,
      action: 'UPDATE',
      changed_by: updatedBy,
    });
    await this.kpiValueHistoryRepository.save(historyEntry);

    Object.assign(kpiValue, updateData);
    kpiValue.updated_at = new Date();
    kpiValue.updated_by = updatedBy;
    return this.kpiValuesRepository.save(kpiValue);
  }

  async delete(id: number, deletedBy: number): Promise<boolean> {
    const kpiValue = await this.kpiValuesRepository.findOne({
      where: { id },
    });
    if (!kpiValue) {
      throw new NotFoundException(`KPI Value with ID ${id} not found`);
    }

    const historyEntry = this.kpiValueHistoryRepository.create({
      kpi_value_id: kpiValue.id,

      value: kpiValue.value,
      timestamp: kpiValue.timestamp,
      notes: kpiValue.notes,
      action: 'DELETE',
      changed_by: deletedBy,
    });
    await this.kpiValueHistoryRepository.save(historyEntry);

    await this.kpiValuesRepository.delete(id);
    return true;
  }

  async submitProgressUpdate(
    assignmentId: number,
    notes: string,
    projectDetails: any[],
    userId: number,
  ): Promise<KpiValue> {
    return await this.dataSource.transaction(
      async (transactionalEntityManager) => {
        const kpiValueRepo = transactionalEntityManager.getRepository(KpiValue);
        const historyRepo =
          transactionalEntityManager.getRepository(KpiValueHistory);
        const assignmentRepo =
          transactionalEntityManager.getRepository(KPIAssignment);

        const assignmentExists = await assignmentRepo.findOneBy({
          id: assignmentId,
        });
        if (!assignmentExists) {
          throw new NotFoundException(
            `KPI Assignment with ID ${assignmentId} not found. Cannot submit progress.`,
          );
        }

        let calculatedValue = 0;
        if (projectDetails && Array.isArray(projectDetails)) {
          calculatedValue = projectDetails.reduce(
            (sum, project) => sum + Number(project.value || 0),
            0,
          );
        }

        let existingRecord = await kpiValueRepo.findOneBy({
          kpi_assigment_id: assignmentId,
        });

        let savedKpiValue: KpiValue;
        let historyAction: string;
        const currentTimestamp = new Date();

        const projectDetailsString = JSON.stringify(projectDetails);

        if (existingRecord) {
          historyAction = 'SUBMIT_UPDATE';

          existingRecord.value = calculatedValue;
          existingRecord.notes = notes;
          existingRecord.project_details = projectDetails;
          existingRecord.status = KpiValueStatus.PENDING_SECTION_APPROVAL;
          existingRecord.timestamp = currentTimestamp;
          existingRecord.updated_by = userId;

          savedKpiValue = await kpiValueRepo.save(existingRecord);
        } else {
          historyAction = 'SUBMIT_CREATE';

          const newKpiValueData: Partial<KpiValue> = {
            kpi_assigment_id: assignmentId,
            value: calculatedValue,
            timestamp: currentTimestamp,
            notes: notes,
            status: KpiValueStatus.PENDING_SECTION_APPROVAL,
            project_details: projectDetails,
            updated_by: userId,
          };

          const newKpiValue = kpiValueRepo.create(newKpiValueData);
          savedKpiValue = await kpiValueRepo.save(newKpiValue);
        }

        const historyEntry = historyRepo.create({
          kpi_value_id: savedKpiValue.id,
          kpi_assigment_id: assignmentId,
          kpi_id: assignmentExists.kpi_id,
          value: savedKpiValue.value,
          timestamp: savedKpiValue.timestamp,
          notes: savedKpiValue.notes,

          action: historyAction,
          changed_by: userId,
        });
        await historyRepo.save(historyEntry);

        return savedKpiValue;
      },
    );
  }

  async getHistory(kpiValueId: number): Promise<KpiValueHistory[]> {
    return this.kpiValueHistoryRepository.find({
      where: { kpi_value_id: kpiValueId },
      order: { changed_at: 'ASC' },
    });
  }

  async approveValueBySection(
    valueId: number,
    sectionUserId: number,
  ): Promise<KpiValue> {
    const kpiValue = await this.findKpiValueForWorkflow(valueId);
    const statusBefore = kpiValue.status;
    const canApprove = await this.checkPermission(
      sectionUserId,
      kpiValue.kpi_assigment_id,
      'SECTION_APPROVE',
    );
    if (!canApprove) {
      throw new UnauthorizedException(
        'User does not have permission to approve at Section level.',
      );
    }
    // Chỉ cho phép duyệt khi đang chờ Section
    if (kpiValue.status !== KpiValueStatus.PENDING_SECTION_APPROVAL) {
      throw new BadRequestException(
        `Cannot approve value from status '${kpiValue.status}'. Expected '${KpiValueStatus.PENDING_SECTION_APPROVAL}'.`,
      );
    }

    kpiValue.status = KpiValueStatus.PENDING_DEPT_APPROVAL; // Chuyển sang chờ Dept
    kpiValue.updated_at = new Date();
    kpiValue.updated_by = sectionUserId;
    kpiValue.rejection_reason = null;

    await this.logWorkflowHistory(
      kpiValue,
      statusBefore,
      'APPROVE_SECTION',
      sectionUserId,
    );
    console.log(
      `[approveValueBySection] SAVING KpiValue ID ${kpiValue.id} with NEW status: ${kpiValue.status}`,
    );
    
    return this.kpiValuesRepository.save(kpiValue);
  }

  async rejectValueBySection(
    valueId: number,
    reason: string,
    sectionUserId: number,
  ): Promise<KpiValue> {
    const kpiValue = await this.findKpiValueForWorkflow(valueId);
    const statusBefore = kpiValue.status;
    const canReject = await this.checkPermission(
      sectionUserId,
      kpiValue.kpi_assigment_id,
      'SECTION_REJECT',
    );
    if (!canReject) {
      throw new UnauthorizedException(
        'User does not have permission to reject at Section level.',
      );
    }
    // Chỉ cho phép từ chối khi đang chờ Section
    if (kpiValue.status !== KpiValueStatus.PENDING_SECTION_APPROVAL) {
      throw new BadRequestException(
        `Cannot reject value from status '${kpiValue.status}'. Expected '${KpiValueStatus.PENDING_SECTION_APPROVAL}'.`,
      );
    }
    if (!reason || reason.trim() === '') {
      throw new BadRequestException('Rejection reason is required.');
    }

    kpiValue.status = KpiValueStatus.REJECTED_BY_SECTION; // Đặt trạng thái bị Section từ chối
    kpiValue.rejection_reason = reason;
    kpiValue.updated_at = new Date();
    kpiValue.updated_by = sectionUserId;

    await this.logWorkflowHistory(
      kpiValue,
      statusBefore,
      'REJECT_SECTION',
      sectionUserId,
      reason,
    );
    return this.kpiValuesRepository.save(kpiValue);
  }

  // --- Cập nhật approve/rejectValueByDepartment ---
  async approveValueByDepartment(
    valueId: number,
    deptUserId: number,
  ): Promise<KpiValue> {
    const kpiValue = await this.findKpiValueForWorkflow(valueId);
    const statusBefore = kpiValue.status;
    const canApprove = await this.checkPermission(
      deptUserId,
      kpiValue.kpi_assigment_id,
      'DEPT_APPROVE',
    );
    if (!canApprove) {
      throw new UnauthorizedException(
        'User does not have permission to approve at Department level.',
      );
    }

    // *** SỬA LOGIC KIỂM TRA TRẠNG THÁI ***
    // Cho phép duyệt nếu đang chờ Dept HOẶC chờ Section (duyệt vượt cấp)
    if (
      ![
        KpiValueStatus.PENDING_DEPT_APPROVAL,
        KpiValueStatus.PENDING_SECTION_APPROVAL,
      ].includes(kpiValue.status)
    ) {
      throw new BadRequestException(
        `Cannot approve value from status '${kpiValue.status}'. Expected '${KpiValueStatus.PENDING_DEPT_APPROVAL}' or '${KpiValueStatus.PENDING_SECTION_APPROVAL}'.`,
      );
    }
    // *** KẾT THÚC SỬA ***

    kpiValue.status = KpiValueStatus.PENDING_MANAGER_APPROVAL; // Luôn chuyển sang chờ Manager
    kpiValue.updated_at = new Date();
    kpiValue.updated_by = deptUserId;
    kpiValue.rejection_reason = null;

    // Ghi log có thể cần bổ sung thông tin về việc vượt cấp nếu muốn
    await this.logWorkflowHistory(
      kpiValue,
      statusBefore,
      'APPROVE_DEPT',
      deptUserId,
    );

    return this.kpiValuesRepository.save(kpiValue);
  }

  async rejectValueByDepartment(
    valueId: number,
    reason: string,
    deptUserId: number,
  ): Promise<KpiValue> {
    const kpiValue = await this.findKpiValueForWorkflow(valueId);
    const statusBefore = kpiValue.status;
    const canReject = await this.checkPermission(
      deptUserId,
      kpiValue.kpi_assigment_id,
      'DEPT_REJECT',
    );
    if (!canReject) {
      throw new UnauthorizedException(
        'User does not have permission to reject at Department level.',
      );
    }

    // *** SỬA LOGIC KIỂM TRA TRẠNG THÁI ***
    // Cho phép từ chối nếu đang chờ Dept HOẶC chờ Section
    if (
      ![
        KpiValueStatus.PENDING_DEPT_APPROVAL,
        KpiValueStatus.PENDING_SECTION_APPROVAL,
      ].includes(kpiValue.status)
    ) {
      throw new BadRequestException(
        `Cannot reject value from status '${kpiValue.status}'. Expected '${KpiValueStatus.PENDING_DEPT_APPROVAL}' or '${KpiValueStatus.PENDING_SECTION_APPROVAL}'.`,
      );
    }
    if (!reason || reason.trim() === '') {
      throw new BadRequestException('Rejection reason is required.');
    }
    // *** KẾT THÚC SỬA ***

    kpiValue.status = KpiValueStatus.REJECTED_BY_DEPT; // Luôn đặt là bị Dept từ chối
    kpiValue.rejection_reason = reason;
    kpiValue.updated_at = new Date();
    kpiValue.updated_by = deptUserId;

    await this.logWorkflowHistory(
      kpiValue,
      statusBefore,
      'REJECT_DEPT',
      deptUserId,
      reason,
    );

    return this.kpiValuesRepository.save(kpiValue);
  }

  // --- Cập nhật approve/rejectValueByManager ---
  async approveValueByManager(
    valueId: number,
    managerUserId: number,
  ): Promise<KpiValue> {
    const kpiValue = await this.findKpiValueForWorkflow(valueId);
    const statusBefore = kpiValue.status;
    const canApprove = await this.checkPermission(
      managerUserId,
      kpiValue.kpi_assigment_id,
      'MANAGER_APPROVE',
    );
    if (!canApprove) {
      throw new UnauthorizedException(
        'User does not have permission to approve at Manager level.',
      );
    }

    if (
      ![
        KpiValueStatus.PENDING_MANAGER_APPROVAL,
        KpiValueStatus.PENDING_DEPT_APPROVAL,
        KpiValueStatus.PENDING_SECTION_APPROVAL,
      ].includes(kpiValue.status)
    ) {
      throw new BadRequestException(
        `Cannot approve value from status '${kpiValue.status}'. Expected a pending status.`,
      );
    }

    kpiValue.status = KpiValueStatus.APPROVED; 
    kpiValue.updated_at = new Date();
    kpiValue.updated_by = managerUserId;
    kpiValue.rejection_reason = null;

    await this.logWorkflowHistory(
      kpiValue,
      statusBefore,
      'APPROVE_MANAGER',
      managerUserId,
    );

    return this.kpiValuesRepository.save(kpiValue);
  }

  async rejectValueByManager(
    valueId: number,
    reason: string,
    managerUserId: number,
  ): Promise<KpiValue> {
    const kpiValue = await this.findKpiValueForWorkflow(valueId);
    const statusBefore = kpiValue.status;
    const canReject = await this.checkPermission(
      managerUserId,
      kpiValue.kpi_assigment_id,
      'MANAGER_REJECT',
    );
    if (!canReject) {
      throw new UnauthorizedException(
        'User does not have permission to reject at Manager level.',
      );
    }

    if (
      ![
        KpiValueStatus.PENDING_MANAGER_APPROVAL,
        KpiValueStatus.PENDING_DEPT_APPROVAL,
        KpiValueStatus.PENDING_SECTION_APPROVAL,
      ].includes(kpiValue.status)
    ) {
      throw new BadRequestException(
        `Cannot reject value from status '${kpiValue.status}'. Expected a pending status.`,
      );
    }
    if (!reason || reason.trim() === '') {
      throw new BadRequestException('Rejection reason is required.');
    }

    kpiValue.status = KpiValueStatus.REJECTED_BY_MANAGER; 
    kpiValue.rejection_reason = reason;
    kpiValue.updated_at = new Date();
    kpiValue.updated_by = managerUserId;

    await this.logWorkflowHistory(
      kpiValue,
      statusBefore,
      'REJECT_MANAGER',
      managerUserId,
      reason,
    );

    return this.kpiValuesRepository.save(kpiValue);
  }

  private async findKpiValueForWorkflow(valueId: number): Promise<KpiValue> {
    const kpiValue = await this.kpiValuesRepository.findOne({
      where: { id: valueId },
      relations: [
        'kpiAssignment',
        'kpiAssignment.section',
        'kpiAssignment.department',
        'kpiAssignment.section.department',
      ],
    });
    if (!kpiValue) {
      throw new NotFoundException(`KPI Value with ID ${valueId} not found.`);
    }
    if (!kpiValue.kpiAssignment) {
      throw new InternalServerErrorException(
        `Assignment not found for KPI Value ID ${valueId}. Data might be inconsistent.`,
      );
    }
    return kpiValue;
  }

  private async checkPermission(
    userId: number,
    assignmentId: number,
    action: string,
  ): Promise<boolean> {
    console.log(
      `--- checkPermission CALLED --- UserID: ${userId}, AssignmentID: ${assignmentId}, Action: ${action}`,
    );

    // 1. Lấy thông tin người dùng thực hiện hành động
    const user = await this.employeeRepository.findOneBy({ id: userId });
    if (!user) {
      console.error(`Permission check failed: User ${userId} not found.`);
      return false;
    }
    console.log(`User found:`, JSON.stringify(user, null, 2));

    // 2. Lấy thông tin assignment VÀ employee được gán (quan trọng)
    const assignment = await this.kpiAssignmentRepository.findOne({
      where: { id: assignmentId },
      relations: [
        'section',
        'department',
        'section.department',
        'employee', // <-- Load cả thông tin employee được gán
      ],
    });

    if (!assignment) {
      console.error(
        `Permission check failed: Assignment ${assignmentId} not found.`,
      );
      return false;
    }
    console.log(`Assignment found:`, JSON.stringify(assignment, null, 2));

    // 3. Xác định Section/Department mục tiêu "hiệu lực"
    let effectiveTargetSectionId: number | null | undefined =
      assignment.assigned_to_section;
    let effectiveTargetDepartmentId: number | null | undefined =
      assignment.assigned_to_department;

    // Nếu gán trực tiếp cho employee, lấy section/dept của employee đó
    if (assignment.assigned_to_employee && assignment.employee) {
      if (
        effectiveTargetSectionId === null ||
        effectiveTargetSectionId === undefined
      ) {
        effectiveTargetSectionId = assignment.employee.sectionId;
      }
      // Lấy Department ID từ Employee nếu assignment không gán trực tiếp cho Dept/Section
      if (
        effectiveTargetDepartmentId === null ||
        effectiveTargetDepartmentId === undefined
      ) {
        effectiveTargetDepartmentId = assignment.employee.departmentId;
      }
    }
    // Nếu gán cho section, lấy department của section đó làm target dept (nếu chưa có)
    else if (
      assignment.assigned_to_section &&
      assignment.section?.department?.id
    ) {
      if (
        effectiveTargetDepartmentId === null ||
        effectiveTargetDepartmentId === undefined
      ) {
        effectiveTargetDepartmentId = assignment.section.department.id;
      }
    }

    console.log(
      `Effective Target Section ID: ${effectiveTargetSectionId}, Effective Target Department ID: ${effectiveTargetDepartmentId}`,
    );

    // 4. Kiểm tra quyền dựa trên action và đơn vị hiệu lực
    let hasRequiredRole = false;

    switch (action) {
      case 'SECTION_APPROVE':
      case 'SECTION_REJECT':
        // Yêu cầu phải có section hiệu lực (từ assignment hoặc employee)
        if (!effectiveTargetSectionId) {
          console.error(
            `Permission Check [${action}]: No effective target section ID found for assignment ${assignmentId}. Denying.`,
          );
          hasRequiredRole = false;
        } else {
          const isLeaderOfSection =
            user.role === 'leader' &&
            user.sectionId === effectiveTargetSectionId;
          const isManager = user.role === 'manager'; // Manager có thể duyệt thay Section?
          const isAdmin = user.role === 'admin';
          hasRequiredRole = isLeaderOfSection || isManager || isAdmin;

          console.log(`--- Permission Check [${action}] Details ---`);
          console.log(
            `- User Role: ${user.role}, User Section: ${user.sectionId}`,
          );
          console.log(
            `- Effective Target Section ID: ${effectiveTargetSectionId}`,
          );
          console.log(`- Is Leader of Section? ${isLeaderOfSection}`);
          console.log(`- Is Manager? ${isManager}`);
          console.log(`- Is Admin? ${isAdmin}`);
          console.log(
            `- Final Permission Result for Section Action: ${hasRequiredRole}`,
          );
        }
        break;

      case 'DEPT_APPROVE':
      case 'DEPT_REJECT':
        // Yêu cầu phải có department hiệu lực
        if (!effectiveTargetDepartmentId) {
          console.error(
            `Permission Check [${action}]: No effective target department ID found for assignment ${assignmentId}. Denying.`,
          );
          hasRequiredRole = false;
        } else {
          const isManagerOfDept =
            user.role === 'manager' &&
            user.departmentId === effectiveTargetDepartmentId;
          const isAdmin = user.role === 'admin';
          hasRequiredRole = isManagerOfDept || isAdmin;

          console.log(`--- Permission Check [${action}] Details ---`);
          console.log(
            `- User Role: ${user.role}, User Department: ${user.departmentId}`,
          );
          console.log(
            `- Effective Target Department ID: ${effectiveTargetDepartmentId}`,
          );
          console.log(`- Is Manager of Department? ${isManagerOfDept}`);
          console.log(`- Is Admin? ${isAdmin}`);
          console.log(
            `- Final Permission Result for Dept Action: ${hasRequiredRole}`,
          );
        }
        break;

      case 'MANAGER_APPROVE':
      case 'MANAGER_REJECT':
        const isManager = user.role === 'manager';
        const isAdmin = user.role === 'admin';
        hasRequiredRole = isManager || isAdmin;

        console.log(`--- Permission Check [${action}] Details ---`);
        console.log(`- User Role: ${user.role}`);
        console.log(`- Is Manager? ${isManager}`);
        console.log(`- Is Admin? ${isAdmin}`);
        console.log(
          `- Final Permission Result for Manager Action: ${hasRequiredRole}`,
        );
        break;

      default:
        console.warn(
          `Permission check: Unknown action '${action}'. Denying access.`,
        );
        hasRequiredRole = false;
        break;
    }

    if (!hasRequiredRole) {
      console.warn(
        `--- Access DENIED by checkPermission --- UserID: ${userId}, AssignmentID: ${assignmentId}, Action: ${action}`,
      );
    } else {
      console.log(
        `--- Access GRANTED by checkPermission --- UserID: ${userId}, AssignmentID: ${assignmentId}, Action: ${action}`,
      );
    }

    return hasRequiredRole;
  }

  private async logWorkflowHistory(
    kpiValue: KpiValue,
    statusBefore: KpiValueStatus | null | undefined,
    action: string,
    changedById: number,
    reason?: string,
  ): Promise<void> {
    const assignment =
      kpiValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOneBy({
        id: kpiValue.kpi_assigment_id,
      }));
    const historyEntryData = {
      kpi_value_id: kpiValue.id,
      kpi_assigment_id: kpiValue.kpi_assigment_id,
      kpi_id: assignment?.kpi_id,
      value: kpiValue.value,
      timestamp: kpiValue.timestamp,
      notes: reason
        ? `Action: ${action}. Reason: ${reason}`
        : `Action: ${action}.`,
      status_before: statusBefore ?? null,
      status_after: kpiValue.status,
      action: action,
      changed_by: changedById,
      changed_at: new Date(),
    };
    const historyEntry = this.kpiValueHistoryRepository.create(
      historyEntryData as DeepPartial<KpiValueHistory>,
    );
    try {
      await this.kpiValueHistoryRepository.save(historyEntry);
    } catch (historyError) {
      console.error(
        `Failed to save KPI Value history for value ID ${kpiValue.id}:`,
        historyError,
      );
    }
  }

  async getPendingApprovals(user: Employee): Promise<KpiValue[]> {
    console.log(
      '--- getPendingApprovals called for user:',
      JSON.stringify(user, null, 2),
    );
    if (!user || !user.role) {
      console.error('getPendingApprovals: Invalid user object received.');
      throw new UnauthorizedException(
        'Invalid user data for fetching pending approvals.',
      );
    }

    const query = this.kpiValuesRepository
      .createQueryBuilder('kpiValue')
      .innerJoinAndSelect('kpiValue.kpiAssignment', 'assignment')
      .leftJoinAndSelect('assignment.kpi', 'kpi')
      .leftJoinAndSelect('assignment.employee', 'assignedEmployee') // Load Employee được gán
      .leftJoinAndSelect('assignment.section', 'assignedSection') // Section được gán trực tiếp
      .leftJoinAndSelect('assignment.department', 'assignedDepartment') // Department được gán trực tiếp
      .leftJoinAndSelect(
        'assignedSection.department',
        'departmentOfAssignedSection',
      ) // Department của Section được gán
      .leftJoinAndSelect('assignedEmployee.section', 'employeeSection') // Section của Employee
      .leftJoinAndSelect('assignedEmployee.department', 'employeeDepartment') // Department của Employee
      .leftJoinAndSelect('kpi.perspective', 'perspective');

    switch (user.role) {
      case 'leader':
        console.log(
          `Applying filter for role: leader, sectionId: ${user.sectionId}`,
        );
        if (!user.sectionId) {
          console.warn('Leader user has no sectionId, returning empty array.');
          return [];
        }
        query
          .where('kpiValue.status = :status', {
            status: KpiValueStatus.PENDING_SECTION_APPROVAL,
          })
          .andWhere(
            new Brackets((qb) => {
              // Hoặc assignment được gán cho section của leader
              qb.where('assignment.assigned_to_section = :sectionId', {
                sectionId: user.sectionId,
              })
                // Hoặc assignment gán cho employee thuộc section của leader
                .orWhere('assignedEmployee.sectionId = :sectionId', {
                  sectionId: user.sectionId,
                });
            }),
          );
        break;

      case 'manager':
        console.log(
          `Applying filter for role: manager, departmentId: ${user.departmentId}, sectionId: ${user.sectionId}`,
        );
        // Dept Manager (có deptId, không có sectionId)
        if (user.departmentId && !user.sectionId) {
          console.log('Applying filter for Dept Manager');
          query
            .where('kpiValue.status = :status', {
              status: KpiValueStatus.PENDING_DEPT_APPROVAL,
            })
            .andWhere(
              new Brackets((qb) => {
                // Assignment gán cho Dept của Manager
                qb.where('assignment.assigned_to_department = :deptId', {
                  deptId: user.departmentId,
                })
                  // Hoặc assignment gán cho Section thuộc Dept của Manager
                  .orWhere('departmentOfAssignedSection.id = :deptId', {
                    deptId: user.departmentId,
                  })
                  // Hoặc assignment gán cho Employee thuộc Dept của Manager
                  .orWhere('assignedEmployee.departmentId = :deptId', {
                    deptId: user.departmentId,
                  });
              }),
            );
        }
        // Manager cuối/cấp cao (Không có deptId hoặc có cả sectionId?) -> Cần làm rõ logic này
        else {
          console.log('Applying filter for Final Manager');
          query.where('kpiValue.status = :status', {
            status: KpiValueStatus.PENDING_MANAGER_APPROVAL,
          });
          // TODO: Có thể cần thêm điều kiện lọc dựa trên phạm vi quản lý của Manager này
        }
        break;

      case 'admin':
        console.log('Applying filter for role: admin (all pending)');
        query.where('kpiValue.status IN (:...statuses)', {
          statuses: [
            KpiValueStatus.PENDING_SECTION_APPROVAL,
            KpiValueStatus.PENDING_DEPT_APPROVAL,
            KpiValueStatus.PENDING_MANAGER_APPROVAL,
          ],
        });
        break;

      default:
        console.log(
          `No pending approvals logic defined for role: ${user.role}`,
        );
        return [];
    }

    query.orderBy('kpiValue.timestamp', 'ASC');

    try {
      console.log('SQL Query:', query.getSql());
      console.log('Parameters:', query.getParameters());
      const results = await query.getMany();
      console.log(`Found ${results.length} pending approvals.`);
      return results;
    } catch (error) {
      console.error('Error executing getPendingApprovals query:', error);
      throw error;
    }
  }
}
