import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Role } from './entities/role.entity';
import { Permission } from '../common/entities/permission.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
  ) {}

  async getAllRoles() {
    return this.roleRepository.find();
  }

  async getRolesWithPermissions() {
    return this.roleRepository.find({ relations: ['permissions'] });
  }

  async getAllPermissions() {
    return this.permissionRepository.find();
  }

  async updateRolePermissions(id: number, permissionIds: number[]) {
    const role = await this.roleRepository.findOne({
      where: { id },
      relations: ['permissions'],
    });
    if (!role) throw new NotFoundException('Role not found');
    const permissions = await this.permissionRepository.findBy({
      id: In(permissionIds),
    });
    role.permissions = permissions;
    await this.roleRepository.save(role);
    return { message: 'Permissions updated successfully.' };
  }

  async createRole(body: { name: string; description?: string }) {
    const exists = await this.roleRepository.findOne({
      where: { name: body.name },
    });
    if (exists) throw new Error('Role name already exists');
    const role = this.roleRepository.create(body);
    await this.roleRepository.save(role);
    return role;
  }

  async updateRole(id: number, body: { name?: string; description?: string }) {
    const role = await this.roleRepository.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    if (body.name) role.name = body.name;
    if (body.description !== undefined) role.description = body.description;
    await this.roleRepository.save(role);
    return role;
  }

  async deleteRole(id: number) {
    const role = await this.roleRepository.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    await this.roleRepository.remove(role);
    return { message: 'Role deleted successfully.' };
  }
}
