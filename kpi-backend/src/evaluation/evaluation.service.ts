import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../entities/employee.entity';
import { Section } from '../entities/section.entity';
import { Department } from '../entities/department.entity';
import { KPIAssignment } from '../entities/kpi-assignment.entity';
import { KpiValue } from '../entities/kpi-value.entity';
import { KpiReview } from '../entities/kpi-review.entity'; // Assuming you have a KpiReview entity
import { ReviewableTargetDto, ReviewCycleDto, KpiToReviewDto, SubmitKpiReviewDto } from './dto/evaluation.dto';

@Injectable()
export class EvaluationService {
  private readonly logger = new Logger(EvaluationService.name);

  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(Section)
    private readonly sectionRepository: Repository<Section>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    @InjectRepository(KPIAssignment)
    private readonly assignmentRepository: Repository<KPIAssignment>,
    @InjectRepository(KpiValue)
    private readonly kpiValueRepository: Repository<KpiValue>,
    @InjectRepository(KpiReview) // Inject KpiReview Repository
    private readonly kpiReviewRepository: Repository<KpiReview>,
  ) {}

  // TODO: Implement logic to get reviewable targets based on currentUser's role
  async getReviewableTargets(currentUser: Employee): Promise<ReviewableTargetDto[]> {
    this.logger.debug(`[getReviewableTargets] Called by user: ${currentUser.id}`);
    // This is complex and depends on your organizational structure and review hierarchy
    // Example: Manager can review employees/sections/departments below them
    // Admin can review everyone
    // For now, return dummy data or implement basic logic
    if (currentUser.role === 'admin') {
        const employees = await this.employeeRepository.find();
        const departments = await this.departmentRepository.find();
        // Map to ReviewableTargetDto
        return [...employees.map(e => ({ id: e.id, name: `${e.first_name} ${e.last_name}`, type: 'employee' as const })),
                ...departments.map(d => ({ id: d.id, name: d.name, type: 'department' as const }))];
    }
    // TODO: Implement logic for Manager/Department/Section roles
    return []; // Return empty for now
  }

  // TODO: Implement logic to get available review cycles
  async getReviewCycles(currentUser: Employee): Promise<ReviewCycleDto[]> {
     this.logger.debug(`[getReviewCycles] Called by user: ${currentUser.id}`);
     // This depends on how you define review cycles (e.g., based on assignment periods, or a separate Cycle entity)
     // For now, return dummy data
     return [
        { id: '2024-Q2', name: 'Quý 2 - 2024' },
        { id: '2024-Q1', name: 'Quý 1 - 2024' },
        { id: '2023-Year', name: 'Năm 2023' },
     ];
  }

  // TODO: Implement logic to fetch KPIs for review for a specific target and cycle
  async getKpisForReview(currentUser: Employee, targetId: number, targetType: 'employee' | 'section' | 'department', cycleId: string): Promise<KpiToReviewDto[]> {
    this.logger.debug(`[getKpisForReview] Called by user: ${currentUser.id} for target ${targetType}:${targetId}, cycle: ${cycleId}`);
    // This requires querying KPIAssignments for the target and cycle,
    // joining with Kpi and KpiValue to get target/actual values,
    // and joining with KpiReview to get existing review data.
    // Also need to apply role-based filtering to ensure currentUser can review this target.
    // For now, return dummy data
    return []; // Return empty for now
  }

  // TODO: Implement logic to submit review data
  async submitKpiReview(currentUser: Employee, reviewData: SubmitKpiReviewDto): Promise<void> {
    this.logger.debug(`[submitKpiReview] Called by user: ${currentUser.id} for target ${reviewData.targetType}:${reviewData.targetId}, cycle: ${reviewData.cycleId}`);
    // This requires validating the reviewData,
    // checking if currentUser has permission to review this target,
    // and saving the review data (e.g., creating/updating KpiReview entities).
    // For now, just log the data
    this.logger.debug(`[submitKpiReview] Received data: ${JSON.stringify(reviewData)}`);
    // TODO: Save data to DB
  }
}