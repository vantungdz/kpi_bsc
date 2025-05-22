// Simple RBAC permission check for FE
// Usage: hasPermission(user, action, resource)
export function hasPermission(user, action, resource) {
  if (!user || !user.role || !user.role.permissions) return false;
  return user.role.permissions.some(
    (p) => p.action === action && p.resource === resource
  );
}
