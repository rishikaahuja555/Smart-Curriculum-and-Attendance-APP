import { createHash } from 'node:crypto';

export function getSession(request, database) {
  if (!request || !database?.prepare) return null;

  const sessionCookie = request.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('airs_session='));

  const token = sessionCookie?.slice('airs_session='.length);
  if (!token) return null;

  const tokenHash = createHash('sha256').update(token).digest('hex');
  const session = database.prepare(`SELECT users.*, sessions.display_name AS session_display_name
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?`).get(tokenHash, Date.now());

  if (session?.id.startsWith('dev-')) {
    database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    return null;
  }

  return session || null;
}

export function requireRole(user, roles) {
  return Boolean(user && Array.isArray(roles) && roles.includes(user.role));
}
