import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { Permission } from '../common/entities/permission.entity';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

/**
 * Module managing roles (Role) and permissions (Permission)
 */
@Module({
  imports: [TypeOrmModule.forFeature([Role, Permission])],
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
