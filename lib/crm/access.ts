type Session = { user?: { role?: unknown; mustChangePassword?: unknown } } | null;

export function getCrmAccess(session: Session) {
  if (!session?.user) return 'anonymous';
  if (session.user.role !== 'admin') return 'forbidden';
  if (session.user.mustChangePassword !== false) return 'password-change';
  return 'allowed';
}
