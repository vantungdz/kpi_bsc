import { Controller, Get, Patch, Param, Body, UseGuards, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { Roles } from './auth/guards/roles.decorator';

@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RolesController {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
  ) {}

  @Get('with-permissions')
  @Roles('admin', 'manager')
  async getRolesWithPermissions() {
    const roles = await this.roleRepository.find({ relations: ['permissions'] });
    return roles;
  }

  @Get('/permissions')
  @Roles('admin', 'manager')
  async getAllPermissions() {
    return this.permissionRepository.find();
  }

  @Patch(':id/permissions')
  @Roles('admin', 'manager')
  async updateRolePermissions(
    @Param('id') id: number,
    @Body('permissionIds') permissionIds: number[],
  ) {
    const role = await this.roleRepository.findOne({ where: { id }, relations: ['permissions'] });
    if (!role) throw new NotFoundException('Role not found');
    const permissions = await this.permissionRepository.findByIds(permissionIds);
    role.permissions = permissions;
    await this.roleRepository.save(role);
    return { message: 'Permissions updated successfully.' };
  }
}
