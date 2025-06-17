import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { PersonalGoal } from './entities/personal-goal.entity';
import { PersonalGoalKpi } from 'src/personal-goal/entities/personal-goal-kpi.entity';
import { CreatePersonalGoalDto, UpdatePersonalGoalDto } from './dto/personal-goal.dto';
import { KPIAssignment } from 'src/kpi-assessments/entities/kpi-assignment.entity';
import { KpiValue, KpiValueStatus } from 'src/kpi-values/entities/kpi-value.entity';

@Injectable()
export class PersonalGoalService {
  constructor(
    @InjectRepository(PersonalGoal)
    private readonly personalGoalRepo: Repository<PersonalGoal>,
    @InjectRepository(PersonalGoalKpi)
    private readonly personalGoalKpiRepo: Repository<PersonalGoalKpi>,
    @InjectRepository(KPIAssignment)
    private readonly kpiAssignmentRepo: Repository<KPIAssignment>,
    @InjectRepository(KpiValue)
    private readonly kpiValueRepo: Repository<KpiValue>,
  ) {}

  async create(employeeId: number, dto: CreatePersonalGoalDto) {
    const { kpiIds = [], ...rest } = dto;
    const goal = this.personalGoalRepo.create({ ...rest, employeeId });
    const savedGoal = await this.personalGoalRepo.save(goal);
    // Tạo các liên kết KPI
    if (kpiIds.length > 0) {
      const links = kpiIds.map(kpiId => this.personalGoalKpiRepo.create({ personalGoalId: savedGoal.id, kpiId }));
      await this.personalGoalKpiRepo.save(links);
    }
    return this.findOne(savedGoal.id, employeeId); // trả về kèm liên kết
  }

  async update(id: number, employeeId: number, dto: UpdatePersonalGoalDto) {
    const { kpiIds = [], ...rest } = dto;
    const goal = await this.findOne(id, employeeId);
    Object.assign(goal, rest);
    await this.personalGoalRepo.save(goal);
    // Cập nhật liên kết KPI
    await this.personalGoalKpiRepo.delete({ personalGoalId: id });
    if (kpiIds.length > 0) {
      const links = kpiIds.map(kpiId => this.personalGoalKpiRepo.create({ personalGoalId: id, kpiId }));
      await this.personalGoalKpiRepo.save(links);
    }
    return this.findOne(id, employeeId);
  }

  async findAllByEmployee(employeeId: number) {
    // Lấy tất cả personal goals của user, kèm liên kết KPI
    const goals = await this.personalGoalRepo.find({
      where: { employeeId },
      order: { createdAt: 'DESC' },
      relations: ['kpiLinks'],
    });
    // Lấy tất cả kpiIds liên kết
    const allKpiIds = goals.flatMap(g => g.kpiLinks?.map(l => l.kpiId) || []);
    // Lấy assignment cho tất cả KPI liên kết của user
    let assignments: KPIAssignment[] = [];
    if (allKpiIds.length > 0) {
      assignments = await this.kpiAssignmentRepo.find({
        where: { employee_id: employeeId, kpi_id: In(allKpiIds) },
        relations: ['kpiValues'],
      });
    }
    // Map assignment theo kpi_id
    const assignmentsMap = new Map<number, KPIAssignment>();
    for (const a of assignments) {
      assignmentsMap.set(a.kpi_id, a);
    }
    // Tính progress cho từng goal (nếu có nhiều KPI, lấy trung bình % các KPI)
    for (const goal of goals) {
      let progressSum = 0;
      let count = 0;
      if (goal.kpiLinks && goal.kpiLinks.length > 0 && goal.targetValue) {
        for (const link of goal.kpiLinks) {
          const assignment = assignmentsMap.get(link.kpiId);
          if (assignment && Array.isArray(assignment.kpiValues) && assignment.kpiValues.length > 0) {
            // Lấy giá trị đã duyệt mới nhất
            const approved = assignment.kpiValues
              .filter(v => v.status === KpiValueStatus.APPROVED)
              .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())[0];
            if (approved) {
              const percent = (Number(approved.value) / Number(goal.targetValue)) * 100;
              progressSum += Math.max(0, Math.min(100, percent));
              count++;
            }
          }
        }
      }
      goal['progress'] = count > 0 ? Math.round(progressSum / count) : 0;
    }
    // Trả về kèm kpiIds cho FE
    return goals.map(g => ({ ...g, kpiIds: g.kpiLinks?.map(l => l.kpiId) || [] }));
  }

  async findAll() {
    return this.personalGoalRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: number, employeeId?: number) {
    const goal = await this.personalGoalRepo.findOne({ where: { id }, relations: ['kpiLinks'] });
    if (!goal) throw new NotFoundException('Personal goal not found');
    if (employeeId && goal.employeeId !== employeeId) throw new ForbiddenException('Not allowed');
    return { ...goal, kpiIds: goal.kpiLinks?.map(l => l.kpiId) || [] };
  }

  async remove(id: number, employeeId: number) {
    const goal = await this.findOne(id, employeeId);
    return this.personalGoalRepo.remove(goal);
  }
}
