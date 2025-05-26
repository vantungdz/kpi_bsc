import { Controller, Get, Patch, Param, Body, UseGuards, NotFoundException, Delete, Post } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../entities';
import { Permission } from '../entities/permission.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { RolesService } from './roles.service';

@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Roles('admin', 'manager')
  async getAllRoles() {
    return this.rolesService.getAllRoles();
  }

  @Get('with-permissions')
  @Roles('admin', 'manager')
  async getRolesWithPermissions() {
    return this.rolesService.getRolesWithPermissions();
  }

  @Get('/permissions')
  @Roles('admin', 'manager')
  async getAllPermissions() {
    return this.rolesService.getAllPermissions();
  }

  @Patch(':id/permissions')
  @Roles('admin', 'manager')
  async updateRolePermissions(
    @Param('id') id: number,
    @Body('permissionIds') permissionIds: number[],
  ) {
    return this.rolesService.updateRolePermissions(id, permissionIds);
  }

  @Post()
  @Roles('admin', 'manager')
  async createRole(@Body() body: { name: string; description?: string }) {
    return this.rolesService.createRole(body);
  }

  @Patch(':id')
  @Roles('admin', 'manager')
  async updateRole(
    @Param('id') id: number,
    @Body() body: { name?: string; description?: string },
  ) {
    return this.rolesService.updateRole(id, body);
  }

  @Delete(':id')
  @Roles('admin', 'manager')
  async deleteRole(@Param('id') id: number) {
    return this.rolesService.deleteRole(id);
  }
}
