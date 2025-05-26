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
    // Chuẩn hóa: user.roles có thể là ["kpi:manager:company", ...]
    const userRoles: string[] = Array.isArray(user.roles)
      ? user.roles.map((r: any) => (typeof r === 'string' ? r : r?.name))
      : [];
    // So khớp động: chỉ cần user có 1 role trùng với requiredRoles
    return userRoles.some((role) => requiredRoles.includes(role));
  }
}
