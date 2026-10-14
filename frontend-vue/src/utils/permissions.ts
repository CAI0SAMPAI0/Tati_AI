export const STAFF_ROLES = new Set([
  'professor',
  'professora',
  'programador',
  'Tatiana',
  'Tati',
  'admin',
  'Admin',
  'Programador',
  'Professora',
]);

export function isStaff(user: { role?: string; username?: string } | null): boolean {
  if (!user) return false;
  const role = user.role ?? '';
  const username = user.username ?? '';
  return STAFF_ROLES.has(role) || STAFF_ROLES.has(username) || STAFF_ROLES.has(role.toLowerCase());
}

export function canAccessDashboard(user: { role?: string; username?: string } | null): boolean {
  if (!user) return false;
  // caio.sampaio é aluno e nunca deve ter acesso ao dashboard
  if (user.username === 'caio.sampaio') return false;
  const role = (user.role || '').toLowerCase();
  if (role === 'student' || role === 'aluno' || role === 'buyer') return false;
  return isStaff(user);
}
