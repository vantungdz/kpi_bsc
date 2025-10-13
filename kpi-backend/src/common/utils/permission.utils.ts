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
