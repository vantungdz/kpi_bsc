import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { Employee } from './entities/employee.entity';
import { Permission } from '../common/entities/permission.entity';
import { Policy } from '../common/entities/policy.entity';
import { Role } from '../roles/entities/role.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { EmployeeSkill } from '../employee-skill/entities/employee-skill.entity';
import { Competency } from '../competency/entities/competency.entity';
import { EmployeeSkillModule } from '../employee-skill/employee-skill.module';
import { CompetencyModule } from '../competency/competency.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Employee,
      Permission,
      Policy,
      Role,
      EmployeeSkill,
      Competency,
    ]),
    AuditLogModule,
    EmployeeSkillModule,
    CompetencyModule,
  ],
  providers: [EmployeesService],
  controllers: [EmployeesController],
  exports: [EmployeesService],
})
export class EmployeesModule {}
