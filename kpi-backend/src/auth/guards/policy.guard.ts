import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { POLICY_CHECK_KEY } from './policy.decorator';
import { getRepository } from 'typeorm';
import { Employee } from 'src/employees/entities/employee.entity';

@Injectable()
export class PolicyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  // Helper: check if user has a permission (action, resource, scope)
  private userHasPermission(user: Employee, action: string, resource: string, scope?: string): boolean {
    if (!user || !user.roles) return false;
    
    // Get all permissions from all roles
    const allPermissions = user.roles.flatMap(role => {
      if (role && Array.isArray(role.permissions)) {
        return role.permissions;
      }
      return [];
    });
    
    // Check permission
    return allPermissions.some(
      (p) =>
        p.action === action &&
        p.resource === resource &&
        (!scope || p.scope === scope)
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policyMeta = this.reflector.get<{ policy: string; options?: any }>(
      POLICY_CHECK_KEY,
      context.getHandler(),
    );
    if (!policyMeta) return true;
    const { policy, options } = policyMeta;
    const request = context.switchToHttp().getRequest();
    const user: Employee = request.user;
    if (!user) return false;

    // Example: check if user is manager of department options.departmentId
    if (policy === 'isManagerOfDepartment') {
      // Check if user has department management permission
      if (!this.userHasPermission(user, 'view', 'kpi', 'department')) return false;
      if (options?.departmentId && user.departmentId !== options.departmentId)
        return false;
      return true;
    }

    // Example: ABAC - check if user is owner of resource
    if (policy === 'isOwner') {
      // options.resourceUserIdField: name of userId field in resource (e.g., createdBy, ownerId, ...)
      const resource = request.resource || request.body || request.params;
      const userIdField = options?.resourceUserIdField || 'userId';
      const resourceUserId = resource?.[userIdField];
      if (!resourceUserId) return false;
      if (user.id !== resourceUserId) return false;
      return true;
    }

    // Example: ABAC - check if user belongs to same department as resource
    if (policy === 'sameDepartment') {
      const resource = request.resource || request.body || request.params;
      const resourceDeptId = resource?.departmentId;
      if (!resourceDeptId) return false;
      if (user.departmentId !== resourceDeptId) return false;
      return true;
    }

    // Can extend more dynamic policies here
    // ...

    // If no policy matches, deny access
    return false;
  }
}
