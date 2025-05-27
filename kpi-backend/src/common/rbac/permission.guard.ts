import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PERMISSION_METADATA_KEY,
  PermissionMeta,
} from './permission.decorator';
import { Employee } from '../../entities/employee.entity';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permission: PermissionMeta = this.reflector.get(
      PERMISSION_METADATA_KEY,
      context.getHandler(),
    );
    if (!permission) return true;

    const request = context.switchToHttp().getRequest();
    const user: Employee = request.user;
    if (
      !user ||
      !user.roles ||
      !Array.isArray(user.roles) ||
      user.roles.length === 0
    ) {
      throw new ForbiddenException('No permission');
    }
    const allPermissions = user.roles.flatMap(
      (role: any) => role.permissions || [],
    );
    const hasPermission = allPermissions.some(
      (p) =>
        p.action === permission.action && p.resource === permission.resource,
    );
    if (!hasPermission) {
      throw new ForbiddenException('Insufficient permission');
    }
    return true;
  }
}
