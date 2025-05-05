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
import { PerformanceEvaluationModule } from './performance-evaluation/performance-evaluation.module';
import { KpiAssignmentsModule } from './kpi-assessments/kpi-assessments.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { EventEmitterModule } from '@nestjs/event-emitter';
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
    EmployeesModule,
    KpisModule,
    DepartmentsModule,
    KpiEvaluationsModule,
    SectionsModule,
    TeamsModule,
    KpiValuesModule,
    PerspectiveModule,
    AuthModule,
    PerformanceEvaluationModule,
    KpiAssignmentsModule,
  ],
  controllers: [],
  // providers: [JwtAuthGuard, RolesGuard],
})
export class AppModule {}
