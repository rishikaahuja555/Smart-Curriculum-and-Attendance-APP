
export function registerAuthRoutes(router, dependencies) {
  const {
    send,
    readJson,
    getSession,
    randomBytes,
    createHash,
    findUserByIdentifier,
    verifyPassword,
    hashPassword,
    publicUser,
    sessionHours,
    rememberMeSeconds,
    database
  } = dependencies;

  // LOGIN
  router.post('/api/auth/login', async ({ request, response }) => {
    const body = await readJson(request);
    const identifier = String(body.identifier || body.enrollment_no || '').trim();
    const password = String(body.password || '');
    const role = String(body.role || '');
    const rememberMe = Boolean(body.rememberMe);

    const demoLoginEnabled =
      process.env.NODE_ENV === 'development' &&
      process.env.AIRS_DEMO_LOGIN === '1';

    if (!demoLoginEnabled && (!identifier || !password)) {
      return send(response, 400, {
        error: 'Enter your account ID and password.'
      });
    }

    const demoIdentifiers = {
      student: 'DEMO-0001',
      teacher: 'Dr. Meera Iyer',
      admin: 'admin@demo.airs.local'
    };

    const matchedUser = role
      ? findUserByIdentifier.get(role, identifier, identifier, identifier)
      : database.prepare(
          'SELECT * FROM users WHERE enrollment = ? COLLATE NOCASE LIMIT 1'
        ).get(identifier);

    const matchedDemoUser =
      matchedUser && !matchedUser.id.startsWith('dev-')
        ? matchedUser
        : null;

    const user = demoLoginEnabled
      ? matchedDemoUser
        ? matchedDemoUser
        : findUserByIdentifier.get(
            role,
            demoIdentifiers[role],
            demoIdentifiers[role],
            demoIdentifiers[role]
          )
      : matchedUser;

    const now = Date.now();

    if (!demoLoginEnabled) {
      if (
        !user ||
        user.status !== 'active' ||
        (user.locked_until && user.locked_until > now) ||
        !verifyPassword(password, user.password_hash)
      ) {
        if (
          user &&
          (!user.locked_until || user.locked_until <= now)
        ) {
          const attempts = (user.failed_attempts || 0) + 1;
          const lockedUntil =
            attempts >= 5 ? now + 15 * 60 * 1000 : null;

          database.prepare(`
            UPDATE users
            SET failed_attempts = ?, locked_until = ?
            WHERE id = ?
          `).run(attempts, lockedUntil, user.id);
        }

        return send(response, 401, {
          error: 'Invalid credentials'
        });
      }

      database.prepare(`
        UPDATE users
        SET failed_attempts = 0, locked_until = NULL
        WHERE id = ?
      `).run(user.id);
    }

    const displayName =
      demoLoginEnabled && !matchedDemoUser
        ? identifier
        : user.name;

    const token = randomBytes(32).toString('base64url');
    const maxAgeSeconds = rememberMe
      ? rememberMeSeconds
      : sessionHours * 60 * 60;

    const expiresAt = Date.now() + maxAgeSeconds * 1000;

    database.prepare(`
      INSERT INTO sessions
      (token_hash, user_id, expires_at, display_name)
      VALUES (?, ?, ?, ?)
    `).run(
      createHash('sha256').update(token).digest('hex'),
      user.id,
      expiresAt,
      displayName
    );

    const secure =
      process.env.NODE_ENV === 'production' ? '; Secure' : '';

    const responseUser = publicUser({
      ...user,
      session_display_name: displayName
    });

    return send(
      response,
      200,
      {
        user: {
          ...responseUser,
          enrollment_no: responseUser.enrollment
        }
      },
      {
        'Set-Cookie':
          `airs_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}${secure}`
      }
    );
  });

  // START ACCOUNT ACTIVATION
  router.post('/api/auth/activate/start', async ({ request, response }) => {
    const body = await readJson(request);
    const enrollmentNo = String(body.enrollment_no || '').trim();

    if (!enrollmentNo) {
      return send(response, 400, { error: 'Enrollment number is required.' });
    }

    const user = database.prepare(`
      SELECT * FROM users
      WHERE enrollment = ? COLLATE NOCASE
      LIMIT 1
    `).get(enrollmentNo);

    if (user && user.status === 'pending') {
      const code = String(
        randomBytes(4).readUInt32BE(0) % 1000000
      ).padStart(6, '0');

      const tokenHash = createHash('sha256')
        .update(code)
        .digest('hex');

      const now = Date.now();

      database.prepare(`
        INSERT INTO account_tokens
        (id, user_id, token_hash, type, expires_at, used_at, created_at)
        VALUES (?, ?, ?, 'activation', ?, NULL, ?)
      `).run(
        randomBytes(16).toString('hex'),
        user.id,
        tokenHash,
        now + 10 * 60 * 1000,
        now
      );
    }

    return send(response, 200, { ok: true });
  });

  // COMPLETE ACCOUNT ACTIVATION
  router.post('/api/auth/activate/complete', async ({ request, response }) => {
    const body = await readJson(request);

    const enrollmentNo = String(body.enrollment_no || '').trim();
    const code = String(body.code || '').trim();
    const password = String(body.password || '');

    if (!enrollmentNo || !code || !password) {
      return send(response, 400, {
        error: 'Enrollment number, activation code and password are required.'
      });
    }

    if (password.length < 8) {
      return send(response, 400, {
        error: 'Password must contain at least 8 characters.'
      });
    }

    const user = database.prepare(`
      SELECT * FROM users
      WHERE enrollment = ? COLLATE NOCASE
      LIMIT 1
    `).get(enrollmentNo);

    if (!user || user.status !== 'pending') {
      return send(response, 400, {
        error: 'Invalid or expired activation code.'
      });
    }

    const token = database.prepare(`
      SELECT * FROM account_tokens
      WHERE user_id = ?
        AND type = 'activation'
        AND used_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `).get(user.id);

    const submittedHash = createHash('sha256')
      .update(code)
      .digest('hex');

    if (
      !token ||
      token.expires_at <= Date.now() ||
      token.token_hash !== submittedHash
    ) {
      return send(response, 400, {
        error: 'Invalid or expired activation code.'
      });
    }

    database.prepare(`
      UPDATE users
      SET password_hash = ?,
          status = 'active',
          failed_attempts = 0,
          locked_until = NULL
      WHERE id = ?
    `).run(hashPassword(password), user.id);

    database.prepare(`
      UPDATE account_tokens
      SET used_at = ?
      WHERE id = ?
    `).run(Date.now(), token.id);

    const activatedUser = database.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).get(user.id);

    const responseUser = publicUser(activatedUser);

    return send(response, 200, {
      user: {
        ...responseUser,
        enrollment_no: responseUser.enrollment
      }
    });
  });

  // LOGOUT
  router.post('/api/auth/logout', ({ request, response }) => {
    const user = getSession(request, database);

    if (user) {
      const tokenCookie = request.headers.cookie
        ?.split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith('airs_session='));

      const token = tokenCookie?.slice('airs_session='.length);

      if (token) {
        database.prepare(
          'DELETE FROM sessions WHERE token_hash = ?'
        ).run(createHash('sha256').update(token).digest('hex'));
      }
    }

    return send(
      response,
      200,
      { ok: true },
      {
        'Set-Cookie':
          'airs_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
      }
    );
  });

  // CURRENT USER
  router.get('/api/auth/me', ({ request, response }) => {
    const user = getSession(request, database);

    return user
      ? send(response, 200, { user: publicUser(user) })
      : send(response, 401, {
          error: 'Please sign in to continue.'
        });
  });
}
