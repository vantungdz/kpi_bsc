export function hasPermission(user, action, resource) {
  if (!user || !user.roles || !Array.isArray(user.roles)) return false;

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

export function userHasPermission(user, action, resource, scope) {
  if (!user || !user.roles || !Array.isArray(user.roles)) return false;

  for (const role of user.roles) {
    if (role && Array.isArray(role.permissions)) {
      if (
        role.permissions.some(
          (p) =>
            p.action === action && p.resource === resource && p.scope === scope
        )
      ) {
        return true;
      }
    }
  }
  return false;
}
