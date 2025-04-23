import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Kpi } from '../entities/kpi.entity';
import { KpiValue } from '../entities/kpi-value.entity';
import { KPIAssignment } from 'src/entities/kpi-assignment.entity';

@Injectable()
export class KpiAssignmentsService {
  constructor(
    @InjectRepository(KPIAssignment)
    private kpiAssignmentRepository: Repository<KPIAssignment>,
    @InjectRepository(KpiValue)
    private kpiValueRepository: Repository<KpiValue>,
  ) {}

  async getUserAssignedKpis(employeeId: number): Promise<KPIAssignment[]> {
    console.log(
      this.kpiAssignmentRepository.find({
        where: { employee_id: employeeId },
        relations: ['kpi', 'kpi.assignments'], // Include related KPI details if needed
      }),
    );

    return this.kpiAssignmentRepository.find({
      where: { employee_id: employeeId },
      relations: ['kpi', 'kpi.assignments'], // Include related KPI details if needed
    });
  }

  // API Gửi Cập nhật Tiến độ KPI
  async updateKpiProgress(
    assignmentId: number,
    notes: string,
    projectDetails: { name: string; value: number }[],
  ): Promise<KpiValue> {
    const assignment = await this.kpiAssignmentRepository.findOne({
      where: { id: assignmentId },
    });

    if (!assignment) {
      throw new NotFoundException(
        `KPI Assignment with ID ${assignmentId} not found`,
      );
    }

    const totalValue = projectDetails.reduce(
      (sum, project) => sum + project.value,
      0,
    );

    const kpiValue = this.kpiValueRepository.create({
      kpi_assigment_id: assignmentId,
      value: totalValue,
      project_details: JSON.stringify(projectDetails),
      timestamp: new Date(),
      updated_by: assignment.employee_id,
      status: 'draft',
      created_at: new Date(),
      updated_at: new Date(),
      notes: notes,
    });

    return this.kpiValueRepository.save(kpiValue);
  }

  // Nhân viên cập nhật target và submit
  async submitTarget(
    assignmentId: number,
    target: number,
    employeeId: number,
  ): Promise<KPIAssignment> {
    const assignment = await this.kpiAssignmentRepository.findOne({
      where: { id: assignmentId, employee_id: employeeId },
    });
    if (!assignment) {
      throw new NotFoundException(
        `KPI Assignment with ID ${assignmentId} not found`,
      );
    }

    assignment.targetValue = target;
    assignment.status = 'submitted';
    assignment.submitted_at = new Date();
    return this.kpiAssignmentRepository.save(assignment);
  }

  // Leader điền kết quả, xác nhận và submit lên manager
  async confirmAndSubmit(
    assignmentId: number,
    result: number,
    notes: string,
    employeeId: number,
  ): Promise<KpiValue> {
    const assignment = await this.kpiAssignmentRepository.findOne({
      where: { id: assignmentId },
    });
    if (!assignment) {
      throw new NotFoundException(
        `KPI Assignment with ID ${assignmentId} not found`,
      );
    }

    const kpiValue = this.kpiValueRepository.create({
      kpi_assigment_id: assignmentId,
      value: result,
      updated_by: employeeId,
      status: 'submitted',
      notes: notes,
      timestamp: new Date(),
    });

    await this.kpiValueRepository.save(kpiValue);

    assignment.status = 'submitted';
    assignment.employee_id = employeeId;
    assignment.approved_at = new Date();
    await this.kpiAssignmentRepository.save(assignment);

    return kpiValue;
  }

  // Manager phê duyệt KPI
  async approveKpiValue(
    kpiValueId: number,
    employeeId: number,
  ): Promise<KpiValue> {
    const kpiValue = await this.kpiValueRepository.findOne({
      where: { id: kpiValueId },
      relations: ['kpiAssignment'],
    });
    if (!kpiValue) {
      throw new NotFoundException(`KPI Value with ID ${kpiValueId} not found`);
    }

    kpiValue.status = 'approved';
    kpiValue.updated_by = employeeId;
    await this.kpiValueRepository.save(kpiValue);

    const assignment = kpiValue.kpiAssignment;
    if (assignment) {
      assignment.status = 'approved';
      assignment.employee_id = employeeId;
      await this.kpiAssignmentRepository.save(assignment);
    }

    return kpiValue;
  }

  // Lấy danh sách KPI đã phê duyệt
  async getApprovedKpiValues(): Promise<KpiValue[]> {
    return this.kpiValueRepository.find({
      where: { status: 'approved' },
      relations: ['kpi', 'user', 'kpiAssignment'],
    });
  }

  async softDelete(id: number): Promise<void> {
    await this.kpiAssignmentRepository.softDelete(id);
  }
}
