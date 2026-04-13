import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KpiFormula } from './entities/kpi-formula.entity';
import { evaluate, mean, sum, dotDivide, dotMultiply, divide } from 'mathjs';

@Injectable()
export class KpiFormulaService {
  constructor(
    @InjectRepository(KpiFormula)
    private readonly formulaRepo: Repository<KpiFormula>,
  ) {}

  async findAll(): Promise<KpiFormula[]> {
    return this.formulaRepo.find();
  }

  async findOne(id: number): Promise<KpiFormula> {
    const formula = await this.formulaRepo.findOneBy({ id });
    if (!formula) throw new NotFoundException('Formula not found');
    return formula;
  }

  async create(data: Partial<KpiFormula>): Promise<KpiFormula> {
    if (data.code) {
      const existed = await this.formulaRepo.findOneBy({ code: data.code });
      if (existed) {
        throw new BadRequestException(
          'Formula code already exists. Please choose a different code.',
        );
      }
    }
    if (data.expression) {
      this.validateFormulaExpression(data.expression);
    }
    const formula = this.formulaRepo.create(data);
    return this.formulaRepo.save(formula);
  }

  async update(id: number, data: Partial<KpiFormula>): Promise<KpiFormula> {
    if (data.code) {
      const existed = await this.formulaRepo.findOneBy({ code: data.code });
      if (existed && existed.id !== id) {
        throw new BadRequestException(
          'Formula code already exists. Please choose a different code.',
        );
      }
    }
    if (data.expression) {
      this.validateFormulaExpression(data.expression);
    }
    const formula = await this.findOne(id);
    Object.assign(formula, data);
    return this.formulaRepo.save(formula);
  }

  async remove(id: number): Promise<void> {
    const formula = await this.findOne(id);
    await this.formulaRepo.remove(formula);
  }

  async calculateScore(
    id: number,
    body:
      | { actualValue: number; targetValue: number }
      | { values: number[]; targets?: number[]; weights?: number[] }
      | { values: number[]; months?: number[]; target?: number; weight?: number }
      | { values: number[]; target?: number; weight?: number },
  ): Promise<{
    applied: boolean;
    score?: number;
    calculatedValue?: number;
    formula?: KpiFormula;
  }> {
    const formula = await this.findOne(id);
    const rules = formula.scoringRules as
      | {
          enabled?: boolean;
          ranges?: Array<{ min?: number; max?: number; score: number }>;
        }
      | undefined;
    const hasMonths =
      'months' in body && Array.isArray(body.months) && body.months.length > 0;
    const hasWeights =
      'weights' in body &&
      Array.isArray(body.weights) &&
      body.weights.length > 0;
    const hasTarget =
      'target' in body && typeof (body as { target?: number }).target === 'number';
    const isScoresOnly =
      'values' in body &&
      Array.isArray(body.values) &&
      body.values.length > 0 &&
      !hasMonths &&
      !hasWeights &&
      !(
        'targets' in body &&
        Array.isArray(body.targets) &&
        body.targets.length > 0
      ) &&
      !('actualValue' in body) &&
      !hasTarget;

    if (!rules?.enabled && !isScoresOnly) {
      return { applied: false };
    }

    let calculatedValue: number;
    if (isScoresOnly && body.values?.length) {
      const arr = body.values as number[];
      calculatedValue = arr.reduce((a, b) => a + b, 0) / arr.length;
    } else {
      const scope = this.buildFormulaScope(body);
      try {
        calculatedValue = Number(
          evaluate(formula.expression, scope as Record<string, unknown>),
        );
      } catch (e) {
        console.log(e);

        console.log('Error evaluating formula:', formula.expression, scope);
        return { applied: false, formula };
      }
    }
    if (Number.isNaN(calculatedValue)) {
      return { applied: false, calculatedValue, formula };
    }

    let score: number | null = null;
    if (rules?.enabled && Array.isArray(rules.ranges)) {
      score = this.applyScoringRules(calculatedValue, rules);
    }
    if (score == null && isScoresOnly) {
      score = Math.max(1, Math.min(5, Math.round(calculatedValue * 2) / 2));
    }
    if (score == null) {
      return { applied: false, calculatedValue, formula };
    }

    return {
      applied: true,
      score,
      calculatedValue,
      formula,
    };
  }

  private buildFormulaScope(
    body:
      | { actualValue: number; targetValue: number }
      | { values: number[]; targets?: number[]; weights?: number[] }
      | { values: number[]; months?: number[]; target?: number; weight?: number }
      | { values: number[]; target?: number; weight?: number },
  ): Record<string, unknown> {
    const hasValues =
      'values' in body && Array.isArray(body.values) && body.values.length > 0;
    const hasTargets =
      'targets' in body &&
      Array.isArray(body.targets) &&
      body.targets.length > 0;
    const hasWeights =
      'weights' in body &&
      Array.isArray(body.weights) &&
      body.weights.length > 0;
    const hasMonths =
      'months' in body && Array.isArray(body.months) && body.months.length > 0;

    if (hasValues && hasTargets && hasWeights) {
      return {
        values: body.values,
        targets: body.targets,
        weights: body.weights,
        sum,
        dotDivide,
        dotMultiply,
        divide,
        average: mean,
      };
    }
    if (hasValues && hasMonths) {
      const scope: Record<string, unknown> = {
        values: body.values,
        months: body.months,
        sum,
        dotMultiply,
        divide,
        average: mean,
      };
      if ('target' in body && typeof (body as { target?: number }).target === 'number') {
        scope.target = (body as { target: number }).target;
      }
      if ('weight' in body && typeof (body as { weight?: number }).weight === 'number') {
        scope.weight = (body as { weight: number }).weight;
      }
      return scope;
    }
    if (hasValues && !hasTargets && !hasWeights && !hasMonths) {
      const scope: Record<string, unknown> = {
        values: body.values,
        sum,
        divide,
        average: mean,
      };
      if ('target' in body && typeof (body as { target?: number }).target === 'number') {
        scope.target = (body as { target: number }).target;
      }
      if ('weight' in body && typeof (body as { weight?: number }).weight === 'number') {
        scope.weight = (body as { weight: number }).weight;
      }
      return scope;
    }
    const actual = 'actualValue' in body ? body.actualValue : 0;
    const target = 'targetValue' in body ? body.targetValue : 0;
    return {
      values: [actual],
      targets: [target],
      target,
      weight: 1,
      average: mean,
      sum,
      dotDivide,
      dotMultiply,
      divide,
    };
  }

  private applyScoringRules(
    value: number,
    rules: { ranges?: Array<{ min?: number; max?: number; score: number }> },
  ): number | null {
    const ranges = rules?.ranges;
    if (!Array.isArray(ranges)) return null;
    for (const r of ranges) {
      // Từ (>): min exclusive. Đến (<=): max inclusive.
      const okMin = r.min === undefined || value > r.min;
      const okMax = r.max === undefined || value <= r.max;
      if (okMin && okMax) return r.score;
    }
    return null;
  }

  private validateFormulaExpression(expression: string) {
    try {
      const scope = {
        values: [1, 2, 3],
        targets: [1, 2, 3],
        weights: [1, 1, 1],
        months: [1, 1, 1],
        target: 1,
        weight: 1,
        average: mean,
        sum,
        dotDivide,
        dotMultiply,
        divide,
      };
      evaluate(expression, scope);
    } catch (e) {
      throw new BadRequestException(
        'Invalid formula: ' + (e instanceof Error ? e.message : String(e)),
      );
    }
  }
}
