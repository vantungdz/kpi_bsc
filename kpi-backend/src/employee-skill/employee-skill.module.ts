import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeSkill } from './entities/employee-skill.entity';
import { EmployeeSkillController } from './employee-skill.controller';
import { EmployeeSkillService } from './employee-skill.service';
import { Employee } from '../employees/entities/employee.entity';
import { Competency } from '../competency/entities/competency.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EmployeeSkill, Employee, Competency])],
  controllers: [EmployeeSkillController],
  providers: [EmployeeSkillService],
  exports: [EmployeeSkillService],
})
export class EmployeeSkillModule {}
