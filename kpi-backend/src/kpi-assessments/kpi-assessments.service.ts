import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  KpiValue,
  KpiValueStatus,
} from '../kpi-values/entities/kpi-value.entity';
import { KPIAssignment } from 'src/kpi-assessments/entities/kpi-assignment.entity';
import { getKpiStatus } from '../kpis/kpis.service';

@Injectable()
export class KpiAssignmentsService {
  constructor(
    @InjectRepository(KPIAssignment)
    private kpiAssignmentRepository: Repository<KPIAssignment>,
    @InjectRepository(KpiValue)
    private kpiValueRepository: Repository<KpiValue>,
  ) {}

  async getUserAssignedKpis(employeeId: number): Promise<KPIAssignment[]> {
    return this.kpiAssignmentRepository.find({
      where: { employee_id: employeeId },
      relations: ['kpi', 'kpi.assignments'],
    });
  }

  async submitTarget(
    assignmentId: number,
    target: number,
    employeeId: number,
  ): Promise<KPIAssignment> {
    const assignment = await this.kpiAssignmentRepository.findOne({
      where: { id: assignmentId, employee_id: employeeId },
      relations: ['kpi'],
    });
    if (!assignment) {
      throw new NotFoundException(
        `KPI Assignment with ID ${assignmentId} not found`,
      );
    }

    // Check if KPI has expired
    if (assignment.kpi) {
      const kpiValidityStatus = getKpiStatus(
        assignment.kpi.start_date,
        assignment.kpi.end_date,
      );
      if (kpiValidityStatus === 'expired') {
        throw new BadRequestException(
          'Cannot update target value for expired KPI. This KPI is no longer valid.',
        );
      }
    }

    assignment.targetValue = target;
    assignment.status = KpiValueStatus.SUBMITTED;
    assignment.submitted_at = new Date();
    return this.kpiAssignmentRepository.save(assignment);
  }

  async getApprovedKpiValues(): Promise<KpiValue[]> {
    return this.kpiValueRepository.find({
      where: { status: KpiValueStatus.APPROVED },
      relations: ['kpi', 'user', 'kpiAssignment'],
    });
  }

  async softDelete(id: number): Promise<void> {
    await this.kpiAssignmentRepository.softDelete(id);
  }
}
