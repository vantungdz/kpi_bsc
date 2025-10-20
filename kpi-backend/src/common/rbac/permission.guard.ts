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
import { Employee } from '../../employees/entities/employee.entity';

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
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check permissions from user.permissions first (from findOneWithPermissions)
    const userWithPermissions = user as any;
    let allPermissions: any[] = [];

    if (
      userWithPermissions.permissions &&
      Array.isArray(userWithPermissions.permissions)
    ) {
      allPermissions = userWithPermissions.permissions;
    } else if (user.roles && Array.isArray(user.roles)) {
      // Fallback to roles.permissions if user.permissions not available
      allPermissions = user.roles.flatMap(
        (role: any) => role.permissions || [],
      );
    }

    if (allPermissions.length === 0) {
      throw new ForbiddenException('No permission');
    }
    const hasPermission = allPermissions.some(
      (p) =>
        p.action === permission.action &&
        p.resource === permission.resource &&
        (!permission.scope || p.scope === permission.scope),
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `Insufficient permission. Required: ${permission.action}:${permission.resource}:${permission.scope || 'any'}`,
      );
    }
    return true;
  }
}
