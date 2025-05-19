import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { POLICY_CHECK_KEY } from './policy.decorator';
import { getRepository } from 'typeorm';
import { Policy } from '../../entities/policy.entity';
import { Employee } from '../../entities/employee.entity';

@Injectable()
export class PolicyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policyMeta = this.reflector.get<{ policy: string; options?: any }>(POLICY_CHECK_KEY, context.getHandler());
    if (!policyMeta) return true;
    const { policy, options } = policyMeta;
    const request = context.switchToHttp().getRequest();
    const user: Employee = request.user;
    if (!user) return false;

    // Ví dụ: kiểm tra user có phải là manager của phòng ban options.departmentId không
    if (policy === 'isManagerOfDepartment') {
      // Nếu user.role là object (sau khi tách role/permission), kiểm tra user.role.name
      const userRole = typeof user.role === 'string' ? user.role : user.role?.name;
      if (userRole !== 'manager') return false;
      if (options?.departmentId && user.departmentId !== options.departmentId) return false;
      return true;
    }

    // Ví dụ: ABAC - kiểm tra user có phải là owner của resource không
    if (policy === 'isOwner') {
      // options.resourceUserIdField: tên trường userId của resource (ví dụ: createdBy, ownerId, ...)
      const resource = request.resource || request.body || request.params;
      const userIdField = options?.resourceUserIdField || 'userId';
      const resourceUserId = resource?.[userIdField];
      if (!resourceUserId) return false;
      if (user.id !== resourceUserId) return false;
      return true;
    }

    // Ví dụ: ABAC - kiểm tra user có thuộc cùng phòng ban với resource không
    if (policy === 'sameDepartment') {
      const resource = request.resource || request.body || request.params;
      const resourceDeptId = resource?.departmentId;
      if (!resourceDeptId) return false;
      if (user.departmentId !== resourceDeptId) return false;
      return true;
    }

    // Có thể mở rộng nhiều policy động khác ở đây
    // ...

    // Nếu không match policy nào thì từ chối
    return false;
  }
}
