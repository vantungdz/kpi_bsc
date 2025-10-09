import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StrategicObjective } from 'src/strategic-objectives/entities/strategic-objective.entity';
import {
  CreateStrategicObjectiveDto,
  UpdateStrategicObjectiveDto,
} from './dto/strategic-objective.dto';
import { Perspective } from 'src/perspective/entities/perspective.entity';
import { Kpi } from 'src/kpis/entities/kpi.entity';

@Injectable()
export class StrategicObjectivesService {
  constructor(
    @InjectRepository(StrategicObjective)
    private readonly strategicObjectiveRepository: Repository<StrategicObjective>,
    @InjectRepository(Perspective)
    private readonly perspectiveRepository: Repository<Perspective>,
    @InjectRepository(Kpi)
    private readonly kpiRepository: Repository<Kpi>,
  ) {}

  async create(dto: CreateStrategicObjectiveDto): Promise<StrategicObjective> {
    const perspective = await this.perspectiveRepository.findOne({
      where: { id: dto.perspectiveId },
    });
    if (!perspective) throw new NotFoundException('Perspective not found');
    const obj = this.strategicObjectiveRepository.create({
      ...dto,
      perspective,
    });
    const saved = await this.strategicObjectiveRepository.save(obj);

    if (dto.kpiIds && Array.isArray(dto.kpiIds) && dto.kpiIds.length > 0) {
      await this.kpiRepository.update(dto.kpiIds, {
        strategicObjective: saved,
      });
    }

    const result = await this.strategicObjectiveRepository.findOne({
      where: { id: saved.id },
      relations: ['perspective', 'kpis'],
    });
    if (!result)
      throw new NotFoundException('Strategic Objective not found after create');
    return result;
  }

  private calcObjectiveProgress(obj: StrategicObjective): number {
    if (!obj.kpis || obj.kpis.length === 0) {
      return 0;
    }
    const progresses = obj.kpis.map((kpi) => {
      const actual =
        typeof (kpi as any).actual_value === 'string'
          ? parseFloat((kpi as any).actual_value)
          : (kpi as any).actual_value;
      let target =
        typeof (kpi as any).target === 'string'
          ? parseFloat((kpi as any).target)
          : (kpi as any).target;
      const progressField = (kpi as any).progress;

      if (
        kpi.formula &&
        (kpi.formula.code === 'percent' ||
          (kpi.formula.expression && kpi.formula.expression.includes('*100')))
      ) {
        target = 100;
      }
      if (
        typeof actual === 'number' &&
        typeof target === 'number' &&
        target > 0
      ) {
        const percent = Math.min(100, Math.round((actual / target) * 100));
        return percent;
      }
      if (typeof progressField === 'number') {
        return progressField;
      }
      return 0;
    });

    if (progresses.length === 1) {
      return progresses[0];
    }

    const avg = progresses.reduce((a, b) => a + b, 0) / progresses.length;
    if (avg < 1) return 0;
    return Math.round(avg);
  }

  async findAll(): Promise<any[]> {
    const list = await this.strategicObjectiveRepository.find({
      relations: ['perspective', 'kpis'],
    });
    for (const obj of list) {
      if (obj.kpis && obj.kpis.length > 0) {
        const kpiIds = obj.kpis.map((k) => k.id);
        obj.kpis = await this.enrichKpisWithActualValue(kpiIds);
      }
    }
    return list.map((obj) => {
      const progress = this.calcObjectiveProgress(obj);

      let warningLevel = 'none';
      let warningMessage = '';
      let expectedProgress = 0;
      if (obj.startDate && obj.endDate) {
        const now = new Date();
        const start = new Date(obj.startDate);
        const end = new Date(obj.endDate);
        if (now > start && end > start) {
          const total = end.getTime() - start.getTime();
          const passed = now.getTime() - start.getTime();
          expectedProgress = Math.min(100, Math.round((passed / total) * 100));
        }
      }
      if (progress < expectedProgress - 10) {
        warningLevel = 'danger';
        warningMessage = `Tiến độ mục tiêu (${progress}%) thấp hơn kỳ vọng (${expectedProgress}%)!`;
      } else if (progress < expectedProgress) {
        warningLevel = 'warning';
        warningMessage = `Tiến độ mục tiêu (${progress}%) chưa đạt kỳ vọng (${expectedProgress}%)!`;
      }
      return {
        ...obj,
        kpis: obj.kpis || [],
        progress,
        warningLevel,
        warningMessage,
      };
    });
  }

  async findOne(id: number): Promise<any> {
    const obj = await this.strategicObjectiveRepository.findOne({
      where: { id },
      relations: ['perspective', 'kpis'],
    });
    if (!obj) throw new NotFoundException('Strategic Objective not found');
    if (!obj.kpis) obj.kpis = [];
    if (obj.kpis.length > 0) {
      const kpiIds = obj.kpis.map((k) => k.id);
      obj.kpis = await this.enrichKpisWithActualValue(kpiIds);
    }

    let warningLevel = 'none';
    let warningMessage = '';
    let expectedProgress = 0;
    if (obj.startDate && obj.endDate) {
      const now = new Date();
      const start = new Date(obj.startDate);
      const end = new Date(obj.endDate);
      if (now > start && end > start) {
        const total = end.getTime() - start.getTime();
        const passed = now.getTime() - start.getTime();
        expectedProgress = Math.min(100, Math.round((passed / total) * 100));
      }
    }
    const progress = this.calcObjectiveProgress(obj);
    if (progress < expectedProgress - 10) {
      warningLevel = 'danger';
      warningMessage = `Tiến độ mục tiêu (${progress}%) thấp hơn kỳ vọng (${expectedProgress}%)!`;
    } else if (progress < expectedProgress) {
      warningLevel = 'warning';
      warningMessage = `Tiến độ mục tiêu (${progress}%) chưa đạt kỳ vọng (${expectedProgress}%)!`;
    }
    return {
      ...obj,
      progress,
      warningLevel,
      warningMessage,
    };
  }

  async update(id: number, dto: UpdateStrategicObjectiveDto): Promise<any> {
    const obj = await this.strategicObjectiveRepository.findOne({
      where: { id },
      relations: ['perspective', 'kpis'],
    });
    if (!obj) throw new NotFoundException('Strategic Objective not found');
    if (dto.perspectiveId) {
      const perspective = await this.perspectiveRepository.findOne({
        where: { id: dto.perspectiveId },
      });
      if (!perspective) throw new NotFoundException('Perspective not found');
      obj.perspective = perspective;
    }

    const { perspectiveId, kpiIds, ...rest } = dto;
    Object.assign(obj, rest);
    const saved = await this.strategicObjectiveRepository.save(obj);

    const safeKpiIds = dto.kpiIds ?? [];
    if (Array.isArray(safeKpiIds)) {
      if (obj.kpis && obj.kpis.length > 0) {
        const kpiIdsToUnlink = obj.kpis
          .map((k) => k.id)
          .filter((id) => !safeKpiIds.includes(id));
        if (kpiIdsToUnlink.length > 0) {
          const updateResult = await this.kpiRepository.update(kpiIdsToUnlink, {
            strategicObjective: null,
          } as any);
        }
      }

      if (safeKpiIds.length > 0) {
        const updateResult2 = await this.kpiRepository.update(safeKpiIds, {
          strategicObjective: saved,
        });
      }
    }

    const result = await this.strategicObjectiveRepository.findOne({
      where: { id: saved.id },
      relations: ['perspective', 'kpis'],
    });
    if (!result)
      throw new NotFoundException('Strategic Objective not found after update');

    if (result.kpis && result.kpis.length > 0) {
      const kpiIds = result.kpis.map((k) => k.id);
      result.kpis = await this.enrichKpisWithActualValue(kpiIds);
    } else {
      result.kpis = [];
    }

    const progress = this.calcObjectiveProgress(result);

    let warningLevel = 'none';
    let warningMessage = '';
    let expectedProgress = 0;
    if (result.startDate && result.endDate) {
      const now = new Date();
      const start = new Date(result.startDate);
      const end = new Date(result.endDate);
      if (now > start && end > start) {
        const total = end.getTime() - start.getTime();
        const passed = now.getTime() - start.getTime();
        expectedProgress = Math.min(100, Math.round((passed / total) * 100));
      }
    }
    if (progress < expectedProgress - 10) {
      warningLevel = 'danger';
      warningMessage = `Tiến độ mục tiêu (${progress}%) thấp hơn kỳ vọng (${expectedProgress}%)!`;
    } else if (progress < expectedProgress) {
      warningLevel = 'warning';
      warningMessage = `Tiến độ mục tiêu (${progress}%) chưa đạt kỳ vọng (${expectedProgress}%)!`;
    }
    return {
      ...result,
      progress,
      warningLevel,
      warningMessage,
    };
  }

  async remove(id: number): Promise<void> {
    const obj = await this.findOne(id);

    const linkedKpis = await this.kpiRepository.find({
      where: { strategicObjective: obj },
    });
    if (linkedKpis.length > 0) {
      await this.kpiRepository.update(
        { strategicObjective: obj },
        { strategicObjective: undefined },
      );
    }
    await this.strategicObjectiveRepository.remove(obj);
  }

  async enrichKpisWithActualValue(kpiIds: number[]): Promise<any[]> {
    if (!kpiIds || kpiIds.length === 0) return [];

    const kpis = await this.kpiRepository
      .createQueryBuilder('kpi')
      .leftJoinAndSelect('kpi.formula', 'formula')
      .leftJoinAndSelect('kpi.assignments', 'assignment')
      .leftJoinAndSelect(
        'assignment.kpiValues',
        'kpiValue',
        'kpiValue.status = :status',
        { status: 'APPROVED' },
      )
      .where('kpi.id IN (:...kpiIds)', { kpiIds })
      .getMany();
    return kpis.map((kpi) => {
      const activeAssignments =
        kpi.assignments?.filter((a) => !a.deleted_at) || [];

      const approvedValues = activeAssignments
        .flatMap((a) =>
          (a.kpiValues || []).filter((v) => v.status === 'APPROVED'),
        )
        .map((v) => Number(v.value) || 0);
      const allTargets = activeAssignments.map(
        (a) => Number(a.targetValue) || 0,
      );
      let actual_value = 0;
      let progress = 0;
      if (kpi.formula && kpi.formula.expression) {
        try {
          const scope = {
            values: approvedValues,
            targets: allTargets,
            target: Number(kpi.target) || 0,
            weight: Number(kpi.weight) || 0,
          };
          const result = require('mathjs').evaluate(
            kpi.formula.expression,
            scope,
          );
          actual_value =
            typeof result === 'number' && !isNaN(result)
              ? parseFloat(result.toFixed(2))
              : 0;

          if (
            kpi.formula.code === 'percent' ||
            (kpi.formula.expression && kpi.formula.expression.includes('*100'))
          ) {
            progress = Math.round(actual_value);
          } else if (
            typeof actual_value === 'number' &&
            typeof scope.target === 'number' &&
            scope.target > 0
          ) {
            progress = Math.round((actual_value / scope.target) * 100);
          } else {
            progress = 0;
          }
        } catch (err) {
          actual_value = 0;
          progress = 0;
        }
      } else {
        actual_value =
          approvedValues.length > 0
            ? approvedValues.reduce((sum, val) => sum + val, 0) /
              approvedValues.length
            : 0;
        if (
          typeof actual_value === 'number' &&
          typeof kpi.target === 'number' &&
          kpi.target > 0
        ) {
          progress = Math.round((actual_value / Number(kpi.target)) * 100);
        } else {
          progress = 0;
        }
      }

      let warningLevel = 'none';
      let warningMessage = '';

      let expectedProgress = 0;
      if (kpi.start_date && kpi.end_date) {
        const now = new Date();
        const start = new Date(kpi.start_date);
        const end = new Date(kpi.end_date);
        if (now > start && end > start) {
          const total = end.getTime() - start.getTime();
          const passed = now.getTime() - start.getTime();
          expectedProgress = Math.min(100, Math.round((passed / total) * 100));
        }
      }
      if (progress < expectedProgress - 10) {
        warningLevel = 'danger';
        warningMessage = `Tiến độ KPI (${progress}%) thấp hơn kỳ vọng (${expectedProgress}%)!`;
      } else if (progress < expectedProgress) {
        warningLevel = 'warning';
        warningMessage = `Tiến độ KPI (${progress}%) chưa đạt kỳ vọng (${expectedProgress}%)!`;
      }
      return { ...kpi, actual_value, progress, warningLevel, warningMessage };
    });
  }

  async statsByStatusAndPerspective() {
    const all = await this.strategicObjectiveRepository.find({
      relations: ['perspective'],
    });

    const result = {};
    for (const obj of all) {
      const perspective = obj.perspective?.name;
      if (!result[perspective])
        result[perspective] = { perspective, active: 0, inactive: 0 };
      if (obj.isActive) result[perspective].active++;
      else result[perspective].inactive++;
    }
    return Object.values(result);
  }

  async statsProgressDistribution() {
    const all = await this.findAll();

    const buckets = [
      { label: '0-25%', min: 0, max: 25, count: 0 },
      { label: '26-50%', min: 26, max: 50, count: 0 },
      { label: '51-75%', min: 51, max: 75, count: 0 },
      { label: '76-99%', min: 76, max: 99, count: 0 },
      { label: '100%', min: 100, max: 100, count: 0 },
    ];
    for (const obj of all) {
      const progress = obj.progress || 0;
      for (const b of buckets) {
        if (progress >= b.min && progress <= b.max) {
          b.count++;
          break;
        }
      }
    }
    return buckets;
  }
}
