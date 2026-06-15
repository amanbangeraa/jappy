export const ROLE_KEY = 'jappy_role';

export type Role = 'student' | 'admin';

export function getRole(): Role | null {
  const r = localStorage.getItem(ROLE_KEY);
  if (r === 'student' || r === 'admin') return r;
  return null;
}

export function setRole(role: Role): void {
  localStorage.setItem(ROLE_KEY, role);
}

export function getRoleHomePath(): string {
  const role = getRole();
  return role === 'admin' ? '/admin' : '/student';
}