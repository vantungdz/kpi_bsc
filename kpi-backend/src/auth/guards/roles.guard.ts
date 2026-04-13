import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>(
      'roles',
      context.getHandler(),
    );
    if (!requiredRoles) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      return false;
    }
    // Normalize: user.roles can be ["kpi:manager:company", ...]
    const userRoles: string[] = Array.isArray(user.roles)
      ? user.roles.map((r: any) => (typeof r === 'string' ? r : r?.name))
      : [];
    // Dynamic matching: user only needs 1 role matching requiredRoles
    return userRoles.some((role) => requiredRoles.includes(role));
  }
}
