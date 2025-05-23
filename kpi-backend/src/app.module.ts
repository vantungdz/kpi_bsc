import { Module } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { EmployeesModule } from './employees/employees.module';
import { KpisModule } from './kpis/kpis.module';
import { DepartmentsModule } from './departments/departments.module';
import { KpiEvaluationsModule } from './kpi-evaluations/kpi-evaluations.module';
import { SectionsModule } from './sections/sections.module';
import { TeamsModule } from './teams/teams.module';
import { KpiValuesModule } from './kpi-values/kpi-values.module';
import { PerspectiveModule } from './perspective/perspective.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KpiAssignmentsModule } from './kpi-assessments/kpi-assessments.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NotificationModule } from './notification/notification.module';
import { DashboardsModule } from './dashboard/dashboard.module';
import { EvaluationModule } from './evaluation/evaluation.module';
import { ReportsModule } from './reports/reports.module';
import { RolesController } from './roles.controller';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => {
        return {
          type: 'postgres',
          host: 'localhost',
          port: 5432,
          username: 'postgres',
          password: 'tomcat',
          database: 'kpi_management',
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: true,
          logging: true,
        };
      },
      inject: [ConfigService],
    }),
    DashboardsModule,
    NotificationModule,
    EmployeesModule,
    KpisModule,
    DepartmentsModule,
    KpiEvaluationsModule,
    SectionsModule,
    TeamsModule,
    KpiValuesModule,
    PerspectiveModule,
    AuthModule,
    KpiAssignmentsModule,
    EvaluationModule,
    ReportsModule,
    TypeOrmModule.forFeature([Role, Permission]),
  ],
  controllers: [RolesController],
})
export class AppModule {}
