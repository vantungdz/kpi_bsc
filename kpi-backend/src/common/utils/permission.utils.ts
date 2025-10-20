import { Employee } from '../../employees/entities/employee.entity';

/**
 * Utility function to check if a user has a specific permission
 * Handles both user.permissions (from findOneWithPermissions) and user.roles.permissions
 */
export function userHasPermission(
  user: Employee,
  action: string,
  resource: string,
  scope?: string,
): boolean {
  if (!user) return false;

  // Check if user has permissions array (from findOneWithPermissions)
  const userWithPermissions = user as any;
  if (
    userWithPermissions.permissions &&
    Array.isArray(userWithPermissions.permissions)
  ) {
    return userWithPermissions.permissions.some(
      (p: any) =>
        p.resource === resource &&
        p.action === action &&
        (!scope || p.scope === scope),
    );
  }

  // Fallback to roles.permissions if permissions array not available
  if (!user.roles) return false;

  const allPermissions = user.roles.flatMap((role: any) =>
    Array.isArray(role.permissions) ? role.permissions : [],
  );

  return allPermissions.some(
    (p: any) =>
      p.resource === resource &&
      p.action === action &&
      (!scope || p.scope === scope),
  );
}

/**
 * Check if a user is a manager of a specific department or section
 * This is more flexible than checking for 'manager' role
 */
export function isManagerOf(
  user: Employee,
  type: 'department' | 'section',
  resourceId: number,
): boolean {
  if (!user) return false;

  if (type === 'department') {
    // Check if user is department manager by checking departmentId
    return user.departmentId === resourceId;
  } else if (type === 'section') {
    // Check if user is section manager by checking sectionId
    return user.sectionId === resourceId;
  }

  return false;
}

/**
 * Check if a user has management permissions for a specific resource
 * This combines role-based permissions with management assignment
 */
export function hasManagementPermission(
  user: Employee,
  action: string,
  resource: string,
  resourceId?: number,
  scope?: string,
): boolean {
  if (!user) return false;

  // First check if user has the specific permission
  if (userHasPermission(user, action, resource, scope)) {
    return true;
  }

  // If no specific permission, check if user is a manager of the resource
  if (resourceId && scope) {
    if (scope === 'department' && isManagerOf(user, 'department', resourceId)) {
      return true;
    } else if (
      scope === 'section' &&
      isManagerOf(user, 'section', resourceId)
    ) {
      return true;
    }
  }

  return false;
}
