// Common formatting helpers

/**
 * Get employee display name from an employee/user object.
 * Safely handles missing fields and falls back to reasonable defaults.
 *
 * @param {Object} emp - Employee or user object
 * @param {string} [emp.first_name]
 * @param {string} [emp.last_name]
 * @param {string} [emp.username]
 * @param {boolean} [iShowUsername]
 * @returns {string} Display name for the employee
 */
export function getFullName(emp, iShowUsername) {
  if (!emp) return '';

  const {
    first_name,
    last_name,
    username,
  } = emp;

  const parts = [];

  if (first_name && typeof first_name === 'string') {
    parts.push(first_name);
  }

  if (last_name && typeof last_name === 'string') {
    parts.push(last_name);
  }

  if (iShowUsername && username && typeof username === 'string') {
    parts.push(` (${username})`);
  }

  if (parts.length > 0) {
    return parts.join(' ').trim();
  }

  return '';
}
