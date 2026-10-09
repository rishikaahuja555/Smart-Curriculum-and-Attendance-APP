export function registerAuthRoutes(router, dependencies) {
  const {
    send,
    readJson,
    getSession,
    requireRole,
    randomBytes,
    createHash,
    findUserByIdentifier,
    verifyPassword,
    publicUser,
    sessionHours,
    rememberMeSeconds,
    database
  } = dependencies;

  router.post('/api/auth/login', async ({ request, response }) => {
    const body = await readJson(request);
    const identifier = String(body.identifier || '').trim();
    const password = String(body.password || '');
    const role = String(body.role || '');
    const rememberMe = Boolean(body.rememberMe);
    const demoLoginEnabled = process.env.NODE_ENV === 'development' && process.env.AIRS_DEMO_LOGIN === '1';
    if (!demoLoginEnabled && (!identifier || !password)) return send(response, 400, { error: 'Enter your account ID and password.' });

    const demoIdentifiers = { student: 'DEMO-0001', teacher: 'Dr. Meera Iyer', admin: 'admin@demo.airs.local' };
    const matchedUser = findUserByIdentifier.get(role, identifier, identifier, identifier);
    const matchedDemoUser = matchedUser && !matchedUser.id.startsWith('dev-') ? matchedUser : null;
    const user = demoLoginEnabled
      ? matchedDemoUser
        ? matchedDemoUser
        : findUserByIdentifier.get(role, demoIdentifiers[role], demoIdentifiers[role], demoIdentifiers[role])
      : matchedUser;

    if (!user || (!demoLoginEnabled && !verifyPassword(password, user.password_hash))) {
      return send(response, 401, { error: 'The account ID or password is incorrect.' });
    }

    const displayName = demoLoginEnabled && !matchedDemoUser ? identifier : user.name;
    const token = randomBytes(32).toString('base64url');
    const maxAgeSeconds = rememberMe ? rememberMeSeconds : sessionHours * 60 * 60;
    const expiresAt = Date.now() + maxAgeSeconds * 1000;
    database.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, display_name) VALUES (?, ?, ?, ?)')
      .run(createHash('sha256').update(token).digest('hex'), user.id, expiresAt, displayName);
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';

    return send(response, 200, { user: publicUser({ ...user, session_display_name: displayName }) }, {
      'Set-Cookie': `airs_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}${secure}`
    });
  });

  router.post('/api/auth/logout', ({ request, response }) => {
    const user = getSession(request, database);
    if (user) {
      const tokenCookie = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith('airs_session='));
      const token = tokenCookie?.slice('airs_session='.length);
      if (token) database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(createHash('sha256').update(token).digest('hex'));
    }
    return send(response, 200, { ok: true }, { 'Set-Cookie': 'airs_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
  });

  router.get('/api/auth/me', ({ request, response }) => {
    const user = getSession(request, database);
    return user
      ? send(response, 200, { user: publicUser(user) })
      : send(response, 401, { error: 'Please sign in to continue.' });
  });
}
