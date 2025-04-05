import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { KpisModule } from './kpis/kpis.module';
import { DepartmentsModule } from './departments/departments.module';
import { KpiEvaluationsModule } from './kpi-evaluations/kpi-evaluations.module';
import { SectionsModule } from './sections/sections.module';
import { TeamsModule } from './teams/teams.module';
import { KpiValuesModule } from './kpi-values/kpi-values.module';
import { UserOrganizationalUnitsModule } from './user-organizational-units/user-organizational-units.module';
import { PerspectiveModule } from './perspective/perspective.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'tomcat',
      database: 'db_kpi',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: false,
      logging: true,
    }),
    UsersModule,
    KpisModule,
    DepartmentsModule,
    KpiEvaluationsModule,
    SectionsModule,
    TeamsModule,
    KpiValuesModule,
    UserOrganizationalUnitsModule,
    PerspectiveModule,
  ], 
})
export class AppModule {}
