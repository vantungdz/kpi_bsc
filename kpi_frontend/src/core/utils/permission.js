// Simple RBAC permission check for FE
// Usage: hasPermission(user, action, resource)
export function hasPermission(user, action, resource) {
  if (!user || !user.roles || !Array.isArray(user.roles)) return false;
  // roles có thể là mảng string (role name) hoặc object (có permissions)
  for (const role of user.roles) {
    if (role && Array.isArray(role.permissions)) {
      if (
        role.permissions.some(
          (p) => p.action === action && p.resource === resource
        )
      ) {
        return true;
      }
    }
  }
  return false;
}
