import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeSkill } from './entities/employee-skill.entity';
import { CreateEmployeeSkillDto, UpdateEmployeeSkillDto } from './dto/employee-skill.dto';
import { Employee } from '../employees/entities/employee.entity';
import { Competency } from '../competency/entities/competency.entity';

@Injectable()
export class EmployeeSkillService {
  constructor(
    @InjectRepository(EmployeeSkill)
    private readonly employeeSkillRepo: Repository<EmployeeSkill>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(Competency)
    private readonly competencyRepo: Repository<Competency>,
  ) {}

  async create(dto: CreateEmployeeSkillDto) {
    const employee = await this.employeeRepo.findOne({ where: { id: dto.employeeId } });
    const competency = await this.competencyRepo.findOne({ where: { id: dto.competencyId } });
    if (!employee || !competency) throw new NotFoundException('Employee or Competency not found');
    const exist = await this.employeeSkillRepo.findOne({ where: { employee: { id: dto.employeeId }, competency: { id: dto.competencyId } } });
    if (exist) throw new NotFoundException('Skill already exists for this employee');
    const skill = this.employeeSkillRepo.create({
      employee,
      competency,
      level: dto.level,
      note: dto.note,
    });
    return this.employeeSkillRepo.save(skill);
  }

  async findAll(employeeId?: number) {
    if (employeeId) {
      return this.employeeSkillRepo.find({ where: { employee: { id: employeeId } }, relations: ['competency'] });
    }
    return this.employeeSkillRepo.find({ relations: ['employee', 'competency'] });
  }

  async update(id: number, dto: UpdateEmployeeSkillDto) {
    const skill = await this.employeeSkillRepo.findOne({ where: { id } });
    if (!skill) throw new NotFoundException('EmployeeSkill not found');
    Object.assign(skill, dto);
    return this.employeeSkillRepo.save(skill);
  }

  async remove(id: number) {
    const skill = await this.employeeSkillRepo.findOne({ where: { id } });
    if (!skill) throw new NotFoundException('EmployeeSkill not found');
    await this.employeeSkillRepo.remove(skill);
    return { message: 'Deleted' };
  }
}
