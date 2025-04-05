import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserOrganizationalUnit } from '../entities/user-organizational-unit.entity';
import { UserOrganizationalUnitsService } from './user-organizational-units.service';
import { UserOrganizationalUnitsController } from './user-organizational-units.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserOrganizationalUnit])],
  providers: [UserOrganizationalUnitsService],
  controllers: [UserOrganizationalUnitsController],
})
export class UserOrganizationalUnitsModule {}
