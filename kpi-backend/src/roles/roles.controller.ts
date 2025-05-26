import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  NotFoundException,
  Delete,
  Post,
  Req,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../entities';
import { PermissionGuard } from '../common/rbac/permission.guard';
import { Permission } from '../common/rbac/permission.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesService } from './roles.service';

@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  async getAllRoles(@Req() req: any) {
    // Log user info and permissions for debugging
    try {
      if (req && req.user) {
        console.log('User info:', req.user);
        console.log('User roles:', req.user.roles);
        if (Array.isArray(req.user.roles)) {
          const allPermissions = req.user.roles.flatMap(
            (role: any) => role.permissions || [],
          );
          console.log('User permissions:', allPermissions);
        }
      }
    } catch (e) {
      /* ignore */
    }
    return this.rolesService.getAllRoles();
  }

  @Get('with-permissions')
  async getRolesWithPermissions(@Req() req: any) {
    // Log current user permissions and required permission
    try {
      if (req && req.user) {
        const userPerms = req.user.roles?.flatMap(
          (role: any) => role.permissions || [],
        );
        console.log(
          'API /roles/with-permissions - User permissions:',
          userPerms,
        );
        console.log('API /roles/with-permissions - Required permission:', {
          action: 'update',
          resource: 'role:company',
        });
      }
    } catch (e) {
      /* ignore */
    }
    return this.rolesService.getRolesWithPermissions();
  }

  @Get('/permissions')
  async getAllPermissions(@Req() req: any) {
    // Log current user permissions and required permission
    try {
      if (req && req.user) {
        const userPerms = req.user.roles?.flatMap(
          (role: any) => role.permissions || [],
        );
        console.log('API /roles/permissions - User permissions:', userPerms);
        console.log('API /roles/permissions - Required permission:', {
          action: 'update',
          resource: 'role:company',
        });
      }
    } catch (e) {
      /* ignore */
    }
    return this.rolesService.getAllPermissions();
  }

  @Patch(':id/permissions')
  async updateRolePermissions(
    @Param('id') id: number,
    @Body('permissionIds') permissionIds: number[],
  ) {
    return this.rolesService.updateRolePermissions(id, permissionIds);
  }

  @Post()
  async createRole(@Body() body: { name: string; description?: string }) {
    return this.rolesService.createRole(body);
  }

  @Patch(':id')
  async updateRole(
    @Param('id') id: number,
    @Body() body: { name?: string; description?: string },
  ) {
    return this.rolesService.updateRole(id, body);
  }

  @Delete(':id')
  async deleteRole(@Param('id') id: number) {
    return this.rolesService.deleteRole(id);
  }
}
