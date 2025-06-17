import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Delete,
  Post,
  Req,
} from '@nestjs/common';
import { PermissionGuard } from '../common/rbac/permission.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesService } from './roles.service';

@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  async getAllRoles(@Req() req: any) {
    return this.rolesService.getAllRoles();
  }

  @Get('with-permissions')
  async getRolesWithPermissions(@Req() req: any) {
    return this.rolesService.getRolesWithPermissions();
  }

  @Get('/permissions')
  async getAllPermissions(@Req() req: any) {
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
