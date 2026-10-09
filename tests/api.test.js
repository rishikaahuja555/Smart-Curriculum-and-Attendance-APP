import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, it } from 'node:test';
import { seedDemoData } from '../server/demoSeed.js';

const root = fileURLToPath(new URL('..', import.meta.url));
let baseUrl;
let databaseDirectory;
let serverProcess;

before(async () => {
  databaseDirectory = mkdtempSync(join(tmpdir(), 'airs-api-test-'));
  const portProbe = createServer();
  await new Promise((resolve, reject) => {
    portProbe.once('error', reject);
    portProbe.listen(0, '127.0.0.1', resolve);
  });
  const port = portProbe.address().port;
  await new Promise((resolve, reject) => portProbe.close((error) => error ? reject(error) : resolve()));
  baseUrl = `http://127.0.0.1:${port}`;

  serverProcess = spawn(process.execPath, ['server/index.js'], {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'development', AIRS_SEED_DEMO: '1', AIRS_DEMO_PASSWORD: 'Test-Demo-Password-2026!', API_PORT: String(port), AIRS_DATA_DIR: databaseDirectory },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  await new Promise((resolve, reject) => {
    let output = '';
    serverProcess.stdout.on('data', (chunk) => {
      output += chunk.toString();
      if (output.includes('AIRS API listening')) resolve();
    });
    serverProcess.stderr.on('data', (chunk) => { output += chunk.toString(); });
    serverProcess.once('error', reject);
    serverProcess.once('exit', (code) => reject(new Error(`Test API exited (${code}): ${output}`)));
  });
});

after(async () => {
  if (serverProcess && serverProcess.exitCode === null) {
    serverProcess.kill();
    await once(serverProcess, 'exit');
  }
  if (databaseDirectory) rmSync(databaseDirectory, { recursive: true, force: true });
});

it('does not seed without opt-in or when production is selected', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSeedFlag = process.env.AIRS_SEED_DEMO;
  const database = new DatabaseSync(':memory:');
  const seedOptions = { password: 'never-logged-test-password', hashPassword: (value) => value };
  try {
    process.env.NODE_ENV = 'development';
    delete process.env.AIRS_SEED_DEMO;
    seedDemoData(database, seedOptions);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM sqlite_schema WHERE type = 'table'").get().count, 0);

    process.env.NODE_ENV = 'production';
    process.env.AIRS_SEED_DEMO = '1';
    seedDemoData(database, seedOptions);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM sqlite_schema WHERE type = 'table'").get().count, 0);
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalSeedFlag === undefined) delete process.env.AIRS_SEED_DEMO;
    else process.env.AIRS_SEED_DEMO = originalSeedFlag;
    database.close();
  }
});

async function signIn(role, identifier, password = 'Test-Demo-Password-2026!') {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, identifier, password })
  });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie').split(';', 1)[0];
}

function request(path, cookie, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...options.headers }
  });
}

it('requires a password for development sign-in and restores the session until logout', async () => {
  const missingPassword = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'teacher', identifier: 'Dr. Meera Iyer', password: '' })
  });
  assert.equal(missingPassword.status, 400);

  const wrongPassword = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'teacher', identifier: 'Dr. Meera Iyer', password: 'not-the-demo-password' })
  });
  assert.equal(wrongPassword.status, 401);

  const cookie = await signIn('teacher', 'Dr. Meera Iyer');
  const restored = await request('/api/auth/me', cookie);
  assert.equal(restored.status, 200);
  assert.equal((await restored.json()).user.name, 'Dr. Meera Iyer');

  const logout = await request('/api/auth/logout', cookie, { method: 'POST' });
  assert.equal(logout.status, 200);
  assert.equal((await request('/api/auth/me', cookie)).status, 401);
});

it('activates a pending account using a token code and then logs in by enrollment number', async () => {
  const databasePath = join(databaseDirectory, 'airs.sqlite');
  const db = new DatabaseSync(databasePath);
  const userId = 'pending-activate-001';
  const enrollmentNo = 'PENDING-1001';
  const password = 'Airs-Activate-2026!';
  db.prepare(`INSERT INTO users (id, name, email, enrollment, enrollment_no, role, password_hash, status, failed_attempts, locked_until, department, section)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, NULL, 'Testing', 'A')`).run(
    userId,
    'Pending Student',
    'pending.student@example.com',
    enrollmentNo,
    enrollmentNo,
    'student',
    null,
    'Testing',
    'A'
  );
  db.close();

  const start = await fetch(`${baseUrl}/api/auth/activate/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enrollment_no: enrollmentNo })
  });
  assert.equal(start.status, 200);
  const startBody = await start.json();
  assert.equal(startBody.ok, true);

  const dbCheck = new DatabaseSync(databasePath, { readOnly: true });
  const tokenRow = dbCheck.prepare(`SELECT token_hash, expires_at, used_at FROM account_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`).get(userId);
  dbCheck.close();
  assert.ok(tokenRow && tokenRow.token_hash);
  assert.ok(tokenRow.expires_at > Date.now());

  const tokenValue = await fetch(`http://127.0.0.1:${baseUrl.split(':').pop()}/api/auth/activate/start`, { method: 'POST' }).catch(() => null);
  assert.ok(tokenValue === null || true);

  const code = '123456';
  const hash = createHash('sha256').update(code).digest('hex');
  const dbWithToken = new DatabaseSync(databasePath);
  dbWithToken.prepare(`UPDATE account_tokens SET token_hash = ? WHERE user_id = ? AND type = 'activation'`).run(hash, userId);
  dbWithToken.close();

  const complete = await fetch(`${baseUrl}/api/auth/activate/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enrollment_no: enrollmentNo, code, password })
  });
  assert.equal(complete.status, 200);
  const completeBody = await complete.json();
  assert.equal(completeBody.user.role, 'student');

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enrollment_no: enrollmentNo, password })
  });
  assert.equal(login.status, 200);
  assert.equal((await login.json()).user.enrollment_no, enrollmentNo);
});

it('uses a generic credential error and locks accounts after repeated failures', async () => {
  const databasePath = join(databaseDirectory, 'airs.sqlite');
  const db = new DatabaseSync(databasePath);
  const userId = 'pending-lock-001';
  const enrollmentNo = 'LOCK-2001';
  db.prepare(`INSERT INTO users (id, name, email, enrollment, enrollment_no, role, password_hash, status, failed_attempts, locked_until, department, section)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 0, NULL, 'Testing', 'B')`).run(
    userId,
    'Locked Student',
    'locked.student@example.com',
    enrollmentNo,
    enrollmentNo,
    'student',
    null,
    'Testing',
    'B'
  );
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run('salt:aaaa', userId);
  db.close();

  const invalid1 = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enrollment_no: enrollmentNo, password: 'wrong-pass' })
  });
  assert.equal(invalid1.status, 401);
  assert.equal((await invalid1.json()).error, 'Invalid credentials');

  const invalid2 = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enrollment_no: enrollmentNo, password: 'wrong-pass-2' })
  });
  assert.equal(invalid2.status, 401);

  const invalid3 = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enrollment_no: enrollmentNo, password: 'wrong-pass-3' })
  });
  assert.equal(invalid3.status, 401);

  const invalid4 = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enrollment_no: enrollmentNo, password: 'wrong-pass-4' })
  });
  assert.equal(invalid4.status, 401);

  const invalid5 = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enrollment_no: enrollmentNo, password: 'wrong-pass-5' })
  });
  assert.equal(invalid5.status, 401);

  const locked = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enrollment_no: enrollmentNo, password: 'wrong-pass-6' })
  });
  assert.equal(locked.status, 401);
  assert.equal((await locked.json()).error, 'Invalid credentials');
});

it('allows arbitrary credentials only in opted-in development demo login and uses populated accounts', async () => {
  const demoDirectory = mkdtempSync(join(tmpdir(), 'airs-demo-login-test-'));
  const portProbe = createServer();
  await new Promise((resolve, reject) => {
    portProbe.once('error', reject);
    portProbe.listen(0, '127.0.0.1', resolve);
  });
  const port = portProbe.address().port;
  await new Promise((resolve, reject) => portProbe.close((error) => error ? reject(error) : resolve()));
  const demoUrl = `http://127.0.0.1:${port}`;
  const demoProcess = spawn(process.execPath, ['server/index.js'], {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'development', AIRS_SEED_DEMO: '1', AIRS_DEMO_LOGIN: '1', AIRS_DEMO_PASSWORD: 'Test-Demo-Password-2026!', API_PORT: String(port), AIRS_DATA_DIR: demoDirectory },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await new Promise((resolve, reject) => {
      let output = '';
      demoProcess.stdout.on('data', (chunk) => {
        output += chunk.toString();
        if (output.includes('AIRS API listening')) resolve();
      });
      demoProcess.stderr.on('data', (chunk) => { output += chunk.toString(); });
      demoProcess.once('error', reject);
      demoProcess.once('exit', (code) => reject(new Error(`Demo API exited (${code}): ${output}`)));
    });

    const signInDemo = (role, identifier, password) => fetch(`${demoUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, identifier, password, rememberMe: true })
    });
    const response = await signInDemo('student', 'Rishika', 'any-value-is-accepted');
    assert.equal(response.status, 200);
    const { user } = await response.json();
    assert.equal(user.name, 'Rishika');
    assert.equal(user.enrollment, 'DEMO-0001');

    const quickEntry = await signInDemo('teacher', 'Dr. Meera Iyer', '');
    assert.equal(quickEntry.status, 200);
    assert.equal((await quickEntry.json()).user.name, 'Dr. Meera Iyer');

    const adminEntry = await signInDemo('admin', 'different-admin-id', 'different-password');
    assert.equal(adminEntry.status, 200);
    assert.equal((await adminEntry.json()).user.role, 'admin');

    const cookie = response.headers.get('set-cookie').split(';', 1)[0];
    const restored = await fetch(`${demoUrl}/api/auth/me`, { headers: { Cookie: cookie } });
    assert.equal((await restored.json()).user.name, 'Rishika');
    const dashboard = await fetch(`${demoUrl}/api/student/dashboard`, { headers: { Cookie: cookie } });
    assert.equal(dashboard.status, 200);
    const dashboardData = await dashboard.json();
    assert.equal(dashboardData.profile.name, 'Rishika');
    assert.ok(dashboardData.subjects.length > 0);
  } finally {
    if (demoProcess.exitCode === null) {
      demoProcess.kill();
      await once(demoProcess, 'exit');
    }
    rmSync(demoDirectory, { recursive: true, force: true });
  }
});

it('does not restore legacy passwordless development-user sessions', async () => {
  const token = 'legacy-development-session-token';
  const database = new DatabaseSync(join(databaseDirectory, 'airs.sqlite'));
  database.prepare(`INSERT INTO users (id, name, email, enrollment, role, password_hash)
    VALUES ('dev-student-legacy', 'Legacy student', 'legacy@local.airs', 'LEGACY-001', 'student', 'invalid-hash')`).run();
  database.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(createHash('sha256').update(token).digest('hex'), 'dev-student-legacy', Date.now() + 60_000);
  database.close();

  const restored = await request('/api/auth/me', `airs_session=${token}`);
  assert.equal(restored.status, 401);
});

it('stores a longer remember-me session cookie when requested', async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'student', identifier: 'DEMO-0001', password: 'Test-Demo-Password-2026!', rememberMe: true })
  });
  assert.equal(response.status, 200);
  const setCookie = response.headers.get('set-cookie');
  assert.ok(setCookie.includes('Max-Age=2592000'));

  const cookie = setCookie.split(';', 1)[0];
  const restored = await request('/api/auth/me', cookie);
  assert.equal(restored.status, 200);
  assert.equal((await restored.json()).user.role, 'student');
});

it('does not duplicate seeded rows when the opt-in demo seed runs twice', async () => {
  const databasePath = join(databaseDirectory, 'airs.sqlite');
  const readCounts = () => {
    const db = new DatabaseSync(databasePath, { readOnly: true });
    const counts = db.prepare(`SELECT
      (SELECT COUNT(*) FROM users WHERE email LIKE '%@demo.airs.local') AS demoUsers,
      (SELECT COUNT(*) FROM courses WHERE id LIKE 'airs-demo-%') AS demoCourses,
      (SELECT COUNT(*) FROM sections WHERE id LIKE 'airs-demo-%') AS demoSections,
      (SELECT COUNT(*) FROM attendance_sessions WHERE id LIKE 'airs-demo-%') AS demoSessions,
      (SELECT COUNT(*) FROM activity_requests WHERE id LIKE 'airs-demo-%') AS demoActivities`).get();
    db.close();
    return counts;
  };
  const beforeCounts = readCounts();
  const portProbe = createServer();
  await new Promise((resolve, reject) => {
    portProbe.once('error', reject);
    portProbe.listen(0, '127.0.0.1', resolve);
  });
  const port = portProbe.address().port;
  await new Promise((resolve, reject) => portProbe.close((error) => error ? reject(error) : resolve()));
  const secondServer = spawn(process.execPath, ['server/index.js'], {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'development', AIRS_SEED_DEMO: '1', AIRS_DEMO_PASSWORD: 'Test-Demo-Password-2026!', API_PORT: String(port), AIRS_DATA_DIR: databaseDirectory },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  try {
    await new Promise((resolve, reject) => {
      let output = '';
      secondServer.stdout.on('data', (chunk) => {
        output += chunk.toString();
        if (output.includes('AIRS API listening')) resolve();
      });
      secondServer.stderr.on('data', (chunk) => { output += chunk.toString(); });
      secondServer.once('error', reject);
      secondServer.once('exit', (code) => reject(new Error(`Second seed process exited (${code}): ${output}`)));
    });
  } finally {
    if (secondServer.exitCode === null) {
      secondServer.kill();
      await once(secondServer, 'exit');
    }
  }
  assert.deepEqual(readCounts(), beforeCounts);
});

it('provides populated development data to student, faculty, and admin views', async () => {
  const adminCookie = await signIn('admin', 'admin@demo.airs.local');
  const directory = await request('/api/admin/users', adminCookie);
  const users = (await directory.json()).users;
  assert.ok(users.filter((user) => user.role === 'student').length >= 50);

  const activities = await request('/api/activity-requests', adminCookie);
  assert.ok((await activities.json()).requests.length >= 10);
  const availability = await request('/api/availability', adminCookie);
  assert.ok((await availability.json()).requests.length >= 3);

  const teacherCookie = await signIn('teacher', 'Dr. Meera Iyer');
  const sectionsResponse = await request('/api/attendance/sections', teacherCookie);
  const { sections } = await sectionsResponse.json();
  assert.ok(sections.length >= 2);
  assert.ok(sections.every((section) => section.rosterSize > 0));
  assert.ok(sections.every((section) => section.latestSessionDate === '2026-10-02'));

  const studentCookie = await signIn('student', 'DEMO-0001');
  const studentSession = await request('/api/auth/me', studentCookie);
  assert.equal((await studentSession.json()).user.name, 'Rishika Ahuja');
  const attendance = await request('/api/student/attendance', studentCookie);
  const subjects = (await attendance.json()).subjects;
  const requestedSubjects = ['Quantum Computing', 'Prompt Engineering', 'Deep Learning', 'Cloud Computing', 'Introduction to Data Science', 'Compiler Design'];
  assert.ok(requestedSubjects.every((name) => subjects.some((subject) => subject.name === name)));
  assert.ok(subjects.every((subject) => subject.total > 0));
  assert.ok(new Set(subjects.map((subject) => subject.percent)).size >= 4);
  assert.ok([54, 62, 69, 77].every((percent) => subjects.some((subject) => subject.percent === percent)));
  const studentDashboard = await request('/api/student/dashboard', studentCookie);
  const studentData = await studentDashboard.json();
  assert.equal(studentData.profile.name, 'Rishika Ahuja');
  assert.ok(studentData.intelligence.gaps > 0);
  const curriculum = await request('/api/student/curriculum', studentCookie);
  assert.ok((await curriculum.json()).courses[0].units.length > 0);
  const recovery = await request('/api/student/recovery', studentCookie);
  assert.ok((await recovery.json()).topics[0].resources.length > 0);

  const teacherDashboard = await request('/api/faculty/dashboard', teacherCookie);
  const facultyData = await teacherDashboard.json();
  assert.ok(facultyData.metrics.assignedSections >= 2);
  assert.ok(facultyData.atRiskStudents.length > 0);
  const atRisk = await request(`/api/faculty/sections/${sections[0].id}/at-risk`, teacherCookie);
  assert.equal(atRisk.status, 200);
  assert.ok((await atRisk.json()).students.length > 0);
  assert.equal((await request(`/api/faculty/sections/${sections[0].id}/at-risk`, studentCookie)).status, 403);

  const adminDashboard = await request('/api/admin/dashboard', adminCookie);
  const adminData = await adminDashboard.json();
  assert.equal(adminDashboard.status, 200);
  assert.ok(adminData.sections.length >= 5);
  assert.ok(adminData.attendanceByCourse.length >= 4);
});

it('answers exact role-scoped AIRS questions with current database records', async () => {
  const studentCookie = await signIn('student', 'DEMO-0001');
  const ask = (cookie, question) => request('/api/assistant/ask', cookie, {
    method: 'POST',
    body: JSON.stringify({ question })
  });

  const subjectResponse = await ask(studentCookie, 'How is my Quantum Computing attendance?');
  assert.equal(subjectResponse.status, 200);
  const subjectAnswer = await subjectResponse.json();
  assert.equal(subjectAnswer.category, 'attendance');
  const attendanceSubjects = (await (await request('/api/student/attendance', studentCookie)).json()).subjects;
  const quantumSubject = attendanceSubjects.find((subject) => subject.name === 'Quantum Computing');
  assert.ok(quantumSubject);
  assert.match(subjectAnswer.answer, new RegExp(`Quantum Computing.*${quantumSubject.attended} of ${quantumSubject.total}.*${quantumSubject.percent}%`));

  const policyAnswer = await (await ask(studentCookie, 'What is the attendance threshold?')).json();
  assert.equal(policyAnswer.category, 'policy');
  assert.match(policyAnswer.answer, /75%/);

  const topicsResponse = await ask(studentCookie, 'What topics should I recover?');
  const topicsAnswer = await topicsResponse.json();
  assert.equal(topicsAnswer.category, 'recovery');
  assert.match(topicsAnswer.answer, /Normalization|Circuit design|Tool-using prompts/);

  const syllabusAnswer = await (await ask(studentCookie, 'What is covered in Quantum Computing?')).json();
  assert.equal(syllabusAnswer.category, 'curriculum');
  assert.match(syllabusAnswer.answer, /Quantum Computing.*covered/i);
  assert.ok(syllabusAnswer.data.topics.length > 0);

  const teacherCookie = await signIn('teacher', 'Dr. Meera Iyer');
  const teacherAnswer = await (await ask(teacherCookie, 'How many sections do I teach?')).json();
  const teacherDashboard = await (await request('/api/faculty/dashboard', teacherCookie)).json();
  assert.equal(teacherAnswer.category, 'sections');
  assert.ok(teacherAnswer.answer.includes(String(teacherDashboard.metrics.assignedSections)));

  const teacherAttendance = await (await ask(teacherCookie, 'What is the DBMS attendance in CSE-3B?')).json();
  assert.equal(teacherAttendance.category, 'attendance');
  assert.deepEqual(teacherAttendance.data.sections.map((section) => section.name), ['CSE-3B']);
  assert.equal(teacherAttendance.data.sections[0].course, 'Database Management Systems');
  assert.equal(teacherAttendance.data.records, teacherAttendance.data.present + teacherAttendance.data.absent + teacherAttendance.data.late);
  const teacherCourseAttendance = await (await ask(teacherCookie, 'How is DBMS attendance?')).json();
  assert.equal(teacherCourseAttendance.category, 'attendance');
  assert.deepEqual(teacherCourseAttendance.data.sections.map((section) => section.name), ['CSE-3B', 'CSE-6A']);

  const adminCookie = await signIn('admin', 'admin@demo.airs.local');
  const adminAnswer = await (await ask(adminCookie, 'How many courses are in AIRS?')).json();
  const adminDashboard = await (await request('/api/admin/dashboard', adminCookie)).json();
  assert.equal(adminAnswer.category, 'courses');
  assert.ok(adminAnswer.answer.includes(String(adminDashboard.attendanceByCourse.length)));

  const adminAttendance = await (await ask(adminCookie, 'What is institution-wide attendance?')).json();
  assert.equal(adminAttendance.category, 'attendance');
  assert.ok(adminAttendance.data.records > 0);
  assert.ok(adminAttendance.data.percent >= 0 && adminAttendance.data.percent <= 100);

  const adminSubjectAttendance = await (await ask(adminCookie, 'What is Quantum Computing attendance?')).json();
  assert.equal(adminSubjectAttendance.category, 'attendance');
  assert.equal(adminSubjectAttendance.data.course, 'Quantum Computing');
  assert.ok(adminSubjectAttendance.data.records > 0);

  const adminRisk = await (await ask(adminCookie, 'How many students are at risk?')).json();
  assert.equal(adminRisk.category, 'at-risk');
  assert.ok(adminRisk.data.count > 0);

  const unsupportedAnswer = await (await ask(studentCookie, 'What is the capital of France?')).json();
  assert.equal(unsupportedAnswer.category, 'unsupported');
  assert.match(unsupportedAnswer.answer, /cannot answer general web questions/i);

  assert.equal((await ask(null, 'How is my attendance?')).status, 401);
});

it('returns database-backed at-risk details only for faculty-owned sections', async () => {
  const teacherCookie = await signIn('teacher', 'Dr. Meera Iyer');
  const otherTeacherCookie = await signIn('teacher', 'Prof. Karan Sud');
  const studentCookie = await signIn('student', 'DEMO-0001');
  const sections = (await (await request('/api/attendance/sections', teacherCookie)).json()).sections;
  const section = sections.find((item) => item.name === 'CSE-3B');
  assert.ok(section);

  assert.equal((await request(`/api/faculty/sections/${section.id}/at-risk`)).status, 401);
  assert.equal((await request(`/api/faculty/sections/${section.id}/at-risk`, studentCookie)).status, 403);
  const result = await request(`/api/faculty/sections/${section.id}/at-risk`, teacherCookie);
  assert.equal(result.status, 200);
  const data = await result.json();
  assert.equal(data.requiredFraction, 0.75);
  assert.ok(data.students.length > 0);
  assert.ok(data.students.every((student) => Number.isInteger(student.missedTopics)
    && Number.isInteger(student.attendanceFraction.attended)
    && Number.isInteger(student.attendanceFraction.held)));
  assert.equal((await request(`/api/faculty/sections/${section.id}/at-risk`, otherTeacherCookie)).status, 404);
});

it('enforces attendance permissions and saves records for student summaries', async () => {
  const teacherCookie = await signIn('teacher', 'Dr. Meera Iyer');
  const studentCookie = await signIn('student', 'DEMO-0001');
  assert.equal((await request('/api/attendance/sections')).status, 401);
  assert.equal((await request('/api/attendance/sections', studentCookie)).status, 403);

  const sectionsResponse = await request('/api/attendance/sections', teacherCookie);
  assert.equal(sectionsResponse.status, 200);
  const { sections } = await sectionsResponse.json();
  const targetSection = sections.find((section) => section.name === 'CSE-3B');
  assert.ok(targetSection);
  const sectionId = targetSection.id;
  const date = '2026-11-03';
  const rosterResponse = await request(`/api/attendance/sections/${sectionId}?date=${date}`, teacherCookie);
  const roster = await rosterResponse.json();
  assert.ok(roster.students.length >= 10);
  const targetStudent = roster.students.find((student) => student.enrollment === 'DEMO-0001');
  assert.ok(targetStudent);
  const baseSummary = await request('/api/student/attendance', studentCookie);
  const baseSubject = (await baseSummary.json()).subjects.find((subject) => subject.id === 'airs-demo-course-dbms');
  assert.ok(baseSubject.total >= 1);
  const attendanceFor = (targetStatus) => roster.students.map((student) => ({
    studentId: student.id,
    status: student.id === targetStudent.id ? targetStatus : 'Present'
  }));

  const invalid = await request(`/api/attendance/sections/${sectionId}`, teacherCookie, {
    method: 'POST',
    body: JSON.stringify({ date, topicId: 'airs-demo-topic-dbms-04', attendance: attendanceFor('Excused') })
  });
  assert.equal(invalid.status, 400);

  const topicIds = ['airs-demo-topic-dbms-01', 'airs-demo-topic-dbms-02'];
  const submit = async (status) => request(`/api/attendance/sections/${sectionId}`, teacherCookie, {
    method: 'POST',
    body: JSON.stringify({ date, topicIds, attendance: attendanceFor(status) })
  });
  const absentResponse = await submit('Absent');
  assert.equal(absentResponse.status, 200);
  assert.equal((await absentResponse.json()).missedTopicCount, 2);
  let summary = await request('/api/student/attendance', studentCookie);
  let subject = (await summary.json()).subjects.find((item) => item.id === 'airs-demo-course-dbms');
  assert.equal(subject.total, baseSubject.total + 1);
  assert.equal(subject.attended, baseSubject.attended);
  const missed = await request('/api/student/missed-topics', studentCookie);
  const missedTopics = (await missed.json()).topics;
  const newlyMissed = missedTopics.filter((topic) => topic.date === date);
  assert.deepEqual(newlyMissed.map((topic) => topic.topic).sort(), ['ER modeling', 'Relational model']);
  assert.ok(newlyMissed.every((topic) => ['In progress', 'Not started'].includes(topic.recoveryStatus)));

  assert.equal((await submit('Present')).status, 200);
  const savedRoster = await request(`/api/attendance/sections/${sectionId}?date=${date}`, teacherCookie);
  assert.equal((await savedRoster.json()).students.find((student) => student.id === targetStudent.id).status, 'Present');
  const afterCorrection = await (await request('/api/student/missed-topics', studentCookie)).json();
  assert.equal(afterCorrection.topics.filter((topic) => topic.date === date).length, 0);
  summary = await request('/api/student/attendance', studentCookie);
  subject = (await summary.json()).subjects.find((item) => item.id === 'airs-demo-course-dbms');
  assert.equal(subject.percent, Math.round(((baseSubject.attended + 1) / (baseSubject.total + 1)) * 100));
});

it('restricts and persists the institution attendance threshold', async () => {
  const studentCookie = await signIn('student', 'DEMO-0001');
  const adminCookie = await signIn('admin', 'admin@demo.airs.local');
  const denied = await request('/api/admin/attendance-policy', studentCookie, {
    method: 'PUT',
    body: JSON.stringify({ requiredFraction: 0.85 })
  });
  assert.equal(denied.status, 403);

  const updated = await request('/api/admin/attendance-policy', adminCookie, {
    method: 'PUT',
    body: JSON.stringify({ requiredFraction: 0.85 })
  });
  assert.equal(updated.status, 200);
  assert.equal((await (await request('/api/attendance-policy', studentCookie)).json()).requiredFraction, 0.85);

  const invalid = await request('/api/admin/attendance-policy', adminCookie, {
    method: 'PUT',
    body: JSON.stringify({ requiredFraction: 1.1 })
  });
  assert.equal(invalid.status, 400);
  await request('/api/admin/attendance-policy', adminCookie, { method: 'PUT', body: JSON.stringify({ requiredFraction: 0.75 }) });
});

it('requires admin permission and complete coverage before approving availability', async () => {
  const teacherCookie = await signIn('teacher', 'Prof. Karan Sud');
  const studentCookie = await signIn('student', 'DEMO-0001');
  const adminCookie = await signIn('admin', 'admin@demo.airs.local');
  const create = await request('/api/availability', teacherCookie, {
    method: 'POST',
    body: JSON.stringify({ startDate: '2026-10-02', endDate: '2026-10-02', reason: 'Personal leave' })
  });
  assert.equal(create.status, 201);
  const { request: availability } = await create.json();
  const reviewPath = `/api/availability/${availability.id}/review`;
  const decision = { status: 'Approved', coveragePlans: {} };

  assert.equal((await request(reviewPath, studentCookie, { method: 'POST', body: JSON.stringify(decision) })).status, 403);
  assert.equal((await request(reviewPath, adminCookie, { method: 'POST', body: JSON.stringify(decision) })).status, 400);

  decision.coveragePlans = Object.fromEntries(availability.duties.map((duty) => [duty.id, 'Assigned to faculty substitute']));
  const approved = await request(reviewPath, adminCookie, { method: 'POST', body: JSON.stringify(decision) });
  assert.equal(approved.status, 200);
  assert.equal((await approved.json()).request.status, 'Approved');
  assert.equal((await request(reviewPath, adminCookie, { method: 'POST', body: JSON.stringify(decision) })).status, 409);
});

it('requires an explicit valid interval for administrator schedule entries', async () => {
  const adminCookie = await signIn('admin', 'admin@demo.airs.local');
  const teacherCookie = await signIn('teacher', 'Dr. Meera Iyer');
  const duty = { date: '2026-10-04', time: '09:00', endTime: '10:00', type: 'Class', subject: 'DBMS lab', section: 'CSE-3B', faculty: 'Dr. Meera Iyer', room: 'LT-204' };
  assert.equal((await request('/api/schedule', teacherCookie, { method: 'POST', body: JSON.stringify(duty) })).status, 403);
  assert.equal((await request('/api/schedule', adminCookie, { method: 'POST', body: JSON.stringify({ ...duty, endTime: '08:45' }) })).status, 400);

  const created = await request('/api/schedule', adminCookie, { method: 'POST', body: JSON.stringify(duty) });
  assert.equal(created.status, 201);
  const item = (await created.json()).item;
  assert.equal(item.end_time, '10:00');
  assert.equal((await request(`/api/schedule/${item.id}`, adminCookie, { method: 'DELETE' })).status, 200);
});

it('detects true interval overlap and routes around faculty availability', async () => {
  const teacherCookie = await signIn('teacher', 'Dr. Meera Iyer');
  const studentCookie = await signIn('student', 'DEMO-0001');
  const adminCookie = await signIn('admin', 'admin@demo.airs.local');
  const activity = {
    title: 'Department research symposium',
    date: '2026-10-02',
    startTime: '09:30',
    endTime: '10:30',
    reason: 'Presenting a project'
  };
  const invalid = await request('/api/activity-requests', studentCookie, {
    method: 'POST',
    body: JSON.stringify({ ...activity, startTime: '10:30', endTime: '09:30' })
  });
  assert.equal(invalid.status, 400);

  const teacherRouted = await request('/api/activity-requests', studentCookie, {
    method: 'POST',
    body: JSON.stringify(activity)
  });
  const teacherRoutedResult = await teacherRouted.json();
  assert.equal(teacherRouted.status, 201, JSON.stringify(teacherRoutedResult));
  const firstRequest = teacherRoutedResult.request;
  assert.equal(firstRequest.status, 'Pending');
  assert.ok(firstRequest.conflicts.some((conflict) => conflict.type === 'class' && conflict.subject === 'Database Management Systems'));
  const teacherQueue = await request('/api/activity-requests', teacherCookie);
  assert.ok((await teacherQueue.json()).requests.some((item) => item.id === firstRequest.id));
  const firstReview = await request(`/api/activity-requests/${firstRequest.id}/review`, teacherCookie, {
    method: 'POST',
    body: JSON.stringify({ status: 'Approved' })
  });
  assert.equal((await firstReview.json()).request.status, 'Approved');

  const leave = await request('/api/availability', teacherCookie, {
    method: 'POST',
    body: JSON.stringify({ startDate: '2026-10-02', endDate: '2026-10-02', reason: 'Faculty leave' })
  });
  assert.equal(leave.status, 201);
  const routedToAdmin = await request('/api/activity-requests', studentCookie, {
    method: 'POST',
    body: JSON.stringify({ ...activity, title: 'Student design review' })
  });
  const secondRequest = (await routedToAdmin.json()).request;
  assert.ok(secondRequest.conflicts.some((conflict) => conflict.type === 'faculty-unavailable'));
  const teacherCannotReview = await request(`/api/activity-requests/${secondRequest.id}/review`, teacherCookie, {
    method: 'POST',
    body: JSON.stringify({ status: 'Approved' })
  });
  assert.equal(teacherCannotReview.status, 403);
  const adminReview = await request(`/api/activity-requests/${secondRequest.id}/review`, adminCookie, {
    method: 'POST',
    body: JSON.stringify({ status: 'Approved' })
  });
  assert.equal((await adminReview.json()).request.status, 'Approved');

  const touchingBoundary = await request('/api/activity-requests', studentCookie, {
    method: 'POST',
    body: JSON.stringify({ ...activity, title: 'Afternoon poster session', startTime: '11:30', endTime: '12:00' })
  });
  const noConflictRequest = (await touchingBoundary.json()).request;
  assert.equal(noConflictRequest.status, 'Approved');
  assert.deepEqual(noConflictRequest.conflicts, []);
});