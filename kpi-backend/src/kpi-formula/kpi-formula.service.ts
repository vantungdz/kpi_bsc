import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KpiFormula } from './entities/kpi-formula.entity';
import { evaluate } from 'mathjs';

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

  private validateFormulaExpression(expression: string) {
    try {
      const scope = {
        values: [1, 2, 3],
        targets: [1, 2, 3],
        target: 1,
        weight: 1,
      };
      evaluate(expression, scope);
    } catch (e) {
      throw new BadRequestException('Invalid formula: ' + e.message);
    }
  }
}
