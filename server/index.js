import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateSafeAbsences } from '../src/data/attendanceRules.js';
import { predictAttendance } from '../src/data/attendanceModel.js';
import { config } from './config.js';
import { applyMigrations } from '../db/migrate.js';
import { createRouter } from './router.js';
import { registerAuthRoutes } from './routes/auth.js';
import { getSession as readSession, requireRole as checkRole } from '../middleware/auth.js';
import { errorResponse } from '../middleware/errors.js';
import { seedDemoData } from './demoSeed.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const dataDirectory = config.dataDirectory || join(root, 'data');
mkdirSync(dataDirectory, { recursive: true });
await applyMigrations();
const database = new DatabaseSync(process.env.AIRS_DB_PATH || join(dataDirectory, 'airs.sqlite'));
const port = config.port;
const sessionHours = config.sessionHours;
const rememberMeSeconds = config.rememberMeSeconds;
const mimeTypes = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.ico': 'image/x-icon', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

if (process.env.NODE_ENV === 'production' && !process.env.AIRS_ADMIN_PASSWORD) {
  throw new Error('Set AIRS_ADMIN_PASSWORD before starting AIRS in production.');
}

 database.exec(`
  PRAGMA busy_timeout = 5000;
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    enrollment TEXT UNIQUE COLLATE NOCASE,
    role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
    password_hash TEXT NOT NULL,
    department TEXT,
    section TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    display_name TEXT
  );
  CREATE TABLE IF NOT EXISTS schedule_items (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    end_time TEXT,
    type TEXT NOT NULL CHECK (type IN ('Class', 'Exam', 'Activity')),
    subject TEXT NOT NULL,
    section TEXT NOT NULL,
    faculty TEXT NOT NULL,
    room TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS availability_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    reason TEXT NOT NULL,
    duties_json TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Pending', 'Approved', 'Declined')),
    coverage_plan TEXT,
    reviewed_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL,
    reviewed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    actor_id TEXT NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,
    target_id TEXT,
    details TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    department TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sections (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id),
    teacher_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    term TEXT NOT NULL,
    planned_sessions INTEGER NOT NULL DEFAULT 16 CHECK (planned_sessions > 0),
    UNIQUE (course_id, name, academic_year, term)
  );
  CREATE TABLE IF NOT EXISTS enrollments (
    student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    enrolled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (student_id, section_id)
  );
  CREATE TABLE IF NOT EXISTS syllabus_units (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    position INTEGER NOT NULL,
    UNIQUE (course_id, title)
  );
  CREATE TABLE IF NOT EXISTS syllabus_topics (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    unit_id TEXT REFERENCES syllabus_units(id),
    unit_name TEXT NOT NULL,
    title TEXT NOT NULL,
    position INTEGER NOT NULL,
    UNIQUE (course_id, unit_name, title)
  );
  CREATE TABLE IF NOT EXISTS section_topic_progress (
    section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    topic_id TEXT NOT NULL REFERENCES syllabus_topics(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('Covered', 'Uncovered')),
    updated_by TEXT REFERENCES users(id),
    updated_at TEXT NOT NULL,
    PRIMARY KEY (section_id, topic_id)
  );
  CREATE TABLE IF NOT EXISTS recovery_resources (
    id TEXT PRIMARY KEY,
    topic_id TEXT NOT NULL REFERENCES syllabus_topics(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    resource_type TEXT NOT NULL CHECK (resource_type IN ('Notes', 'Practice', 'Video', 'Reading')),
    url TEXT,
    UNIQUE (topic_id, title)
  );
  CREATE TABLE IF NOT EXISTS attendance_sessions (
    id TEXT PRIMARY KEY,
    section_id TEXT NOT NULL REFERENCES sections(id),
    teacher_id TEXT NOT NULL REFERENCES users(id),
    session_date TEXT NOT NULL,
    topic_id TEXT REFERENCES syllabus_topics(id),
    created_at TEXT NOT NULL,
    UNIQUE (section_id, session_date)
  );
  CREATE TABLE IF NOT EXISTS attendance_records (
    session_id TEXT NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES users(id),
    status TEXT NOT NULL CHECK (status IN ('Present', 'Late', 'Absent')),
    marked_by TEXT NOT NULL REFERENCES users(id),
    marked_at TEXT NOT NULL,
    PRIMARY KEY (session_id, student_id)
  );
  CREATE TABLE IF NOT EXISTS session_topics (
    session_id TEXT NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    topic_id TEXT NOT NULL REFERENCES syllabus_topics(id),
    PRIMARY KEY (session_id, topic_id)
  );
  CREATE TABLE IF NOT EXISTS missed_topics (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    topic_id TEXT NOT NULL REFERENCES syllabus_topics(id),
    created_at TEXT NOT NULL,
    UNIQUE (session_id, student_id, topic_id),
    FOREIGN KEY (session_id, student_id) REFERENCES attendance_records(session_id, student_id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS recovery_progress (
    missed_topic_id TEXT PRIMARY KEY REFERENCES missed_topics(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('Not started', 'In progress', 'Completed')),
    started_at TEXT,
    completed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS academic_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS activity_requests (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    activity_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Pending', 'Approved', 'Declined')),
    conflicts_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    reviewed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS activity_request_reviews (
    request_id TEXT NOT NULL REFERENCES activity_requests(id) ON DELETE CASCADE,
    reviewer_id TEXT NOT NULL REFERENCES users(id),
    status TEXT NOT NULL CHECK (status IN ('Pending', 'Approved', 'Declined')),
    decision_note TEXT,
    reviewed_at TEXT,
    PRIMARY KEY (request_id, reviewer_id)
  );
  CREATE INDEX IF NOT EXISTS schedule_date_idx ON schedule_items(date, time);
  CREATE INDEX IF NOT EXISTS availability_status_idx ON availability_requests(status, created_at);
  CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS sections_teacher_idx ON sections(teacher_id, name);
  CREATE INDEX IF NOT EXISTS enrollments_section_idx ON enrollments(section_id, student_id);
  CREATE INDEX IF NOT EXISTS attendance_student_idx ON attendance_records(student_id, session_id);
  CREATE INDEX IF NOT EXISTS activity_request_status_idx ON activity_requests(status, activity_date, start_time);
  CREATE INDEX IF NOT EXISTS activity_review_queue_idx ON activity_request_reviews(reviewer_id, status);
  CREATE INDEX IF NOT EXISTS syllabus_units_course_idx ON syllabus_units(course_id, position);
  CREATE INDEX IF NOT EXISTS section_topic_status_idx ON section_topic_progress(section_id, status);
  CREATE INDEX IF NOT EXISTS recovery_resources_topic_idx ON recovery_resources(topic_id);
`);

if (!database.prepare('PRAGMA table_info(sessions)').all().some((column) => column.name === 'display_name')) {
  database.exec('ALTER TABLE sessions ADD COLUMN display_name TEXT');
}
if (!database.prepare('PRAGMA table_info(schedule_items)').all().some((column) => column.name === 'end_time')) {
  database.exec('ALTER TABLE schedule_items ADD COLUMN end_time TEXT');
}
if (!database.prepare('PRAGMA table_info(sections)').all().some((column) => column.name === 'planned_sessions')) {
  database.exec('ALTER TABLE sections ADD COLUMN planned_sessions INTEGER NOT NULL DEFAULT 16 CHECK (planned_sessions > 0)');
}
if (!database.prepare('PRAGMA table_info(syllabus_topics)').all().some((column) => column.name === 'unit_id')) {
  database.exec('ALTER TABLE syllabus_topics ADD COLUMN unit_id TEXT REFERENCES syllabus_units(id)');
}
database.exec('CREATE INDEX IF NOT EXISTS syllabus_topics_unit_idx ON syllabus_topics(unit_id, position)');

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

function verifyPassword(password, storedHash) {
  const [salt, expectedHex] = storedHash.split(':');
  if (!salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function seedUser({ id, name, email, enrollment = null, role, password, department = null, section = null }) {
  database.prepare(`INSERT OR IGNORE INTO users (id, name, email, enrollment, role, password_hash, department, section)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, name, email, enrollment, role, hashPassword(password), department, section);
}

if (process.env.NODE_ENV === 'production') {
  seedUser({ id: 'admin-1', name: 'Alicia Reed', email: process.env.AIRS_ADMIN_EMAIL || 'admin@airs.edu', role: 'admin', password: process.env.AIRS_ADMIN_PASSWORD, department: 'Administration' });
}

const findUserByIdentifier = database.prepare(`SELECT * FROM users WHERE role = ? AND (
  email = ? COLLATE NOCASE OR enrollment = ? COLLATE NOCASE OR name = ? COLLATE NOCASE
) LIMIT 1`);

function createDevelopmentUser(role, identifier) {
  if (!['student', 'teacher', 'admin'].includes(role)) return null;
  const digest = createHash('sha256').update(`${role}:${identifier.toLowerCase()}`).digest('hex');
  const user = {
    id: `dev-${role}-${digest}`,
    name: role === 'student' ? `Student ${identifier}` : identifier,
    email: `dev-${digest}@local.airs`,
    enrollment: role === 'student' ? identifier : null,
    role,
    password_hash: hashPassword(randomBytes(32).toString('hex')),
    department: null,
    section: null
  };
  database.prepare(`INSERT OR IGNORE INTO users (id, name, email, enrollment, role, password_hash, department, section)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(user.id, user.name, user.email, user.enrollment, user.role, user.password_hash, user.department, user.section);
  return findUserByIdentifier.get(role, identifier, identifier, identifier);
}

const publicUser = ({ password_hash, session_display_name, ...user }) => ({
  ...user,
  name: session_display_name || user.name
});
const selectSchedule = database.prepare('SELECT * FROM schedule_items WHERE date BETWEEN ? AND ? ORDER BY date, time');
const insertAudit = database.prepare(`INSERT INTO audit_events (id, actor_id, action, target_id, details, created_at)
  VALUES (?, ?, ?, ?, ?, ?)`);

if (process.env.AIRS_SEED_DEMO === '1' && process.env.NODE_ENV !== 'production') {
  seedDemoData(database, { password: process.env.AIRS_DEMO_PASSWORD, hashPassword });
}

function send(response, status, value, extraHeaders = {}) {
  response.writeHead(status, { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders });
  response.end(JSON.stringify(value));
}

async function readJson(request) {
  let content = '';
  for await (const chunk of request) {
    content += chunk;
    if (content.length > 1_000_000) throw new Error('Request body too large.');
  }
  return content ? JSON.parse(content) : {};
}

function getSession(request) {
  return readSession(request, database);
}

function requireRole(user, roles) {
  return checkRole(user, roles);
}

function parseRequest(row) {
  return {
    id: row.id,
    faculty: row.name,
    facultyId: row.user_id,
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason,
    duties: JSON.parse(row.duties_json),
    status: row.status,
    coveragePlan: row.coverage_plan ? JSON.parse(row.coverage_plan) : null,
    reviewedBy: row.reviewed_by || null,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at
  };
}

function parseActivityRequest(row) {
  const reviews = database.prepare(`SELECT activity_request_reviews.reviewer_id AS reviewerId,
    activity_request_reviews.status, activity_request_reviews.decision_note AS decisionNote,
    activity_request_reviews.reviewed_at AS reviewedAt, users.name AS reviewer
    FROM activity_request_reviews JOIN users ON users.id = activity_request_reviews.reviewer_id
    WHERE activity_request_reviews.request_id = ? ORDER BY users.name`).all(row.id);
  return {
    id: row.id,
    studentId: row.student_id,
    student: row.student_name,
    title: row.title,
    date: row.activity_date,
    startTime: row.start_time,
    endTime: row.end_time,
    reason: row.reason,
    status: row.status,
    conflicts: JSON.parse(row.conflicts_json),
    reviews,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at
  };
}

const availabilitySelectSql = `SELECT availability_requests.*, users.name
  FROM availability_requests JOIN users ON users.id = availability_requests.user_id`;
const availabilitySelect = database.prepare(`${availabilitySelectSql} ORDER BY created_at DESC`);
const getAvailabilityForTeacher = database.prepare(`${availabilitySelectSql} WHERE user_id = ? ORDER BY created_at DESC`);
const getAvailabilityById = database.prepare('SELECT * FROM availability_requests WHERE id = ?');
const getActivityRequestById = database.prepare(`SELECT activity_requests.*, users.name AS student_name
  FROM activity_requests JOIN users ON users.id = activity_requests.student_id WHERE activity_requests.id = ?`);

function attendanceTrend(records) {
  const windowSize = Math.min(4, Math.floor(records.length / 2));
  if (!windowSize) return 'stable';
  const attended = (record) => record.status === 'Present' || record.status === 'Late' ? 1 : 0;
  const previous = records.slice(-windowSize * 2, -windowSize);
  const recent = records.slice(-windowSize);
  const previousRate = previous.reduce((total, record) => total + attended(record), 0) / previous.length;
  const recentRate = recent.reduce((total, record) => total + attended(record), 0) / recent.length;
  return recentRate < previousRate - 0.05 ? 'down' : recentRate > previousRate + 0.05 ? 'up' : 'stable';
}

function getAtRiskStudents(section) {
  const requiredFraction = Number(database.prepare("SELECT value FROM academic_settings WHERE key = 'required_attendance_fraction'").get()?.value || 0.75);
  const syllabus = database.prepare(`SELECT COUNT(syllabus_topics.id) AS total,
    SUM(CASE WHEN section_topic_progress.status = 'Covered' THEN 1 ELSE 0 END) AS covered
    FROM sections JOIN syllabus_topics ON syllabus_topics.course_id = sections.course_id
    LEFT JOIN section_topic_progress ON section_topic_progress.section_id = sections.id
      AND section_topic_progress.topic_id = syllabus_topics.id
    WHERE sections.id = ?`).get(section.id);
  const syllabusPct = syllabus.total ? Math.round((Number(syllabus.covered || 0) / syllabus.total) * 100) : 0;
  const roster = database.prepare(`SELECT users.id, users.name, users.enrollment FROM enrollments
    JOIN users ON users.id = enrollments.student_id WHERE enrollments.section_id = ? ORDER BY users.name`).all(section.id);
  const getHistory = database.prepare(`SELECT attendance_records.status, attendance_sessions.session_date
    FROM attendance_records JOIN attendance_sessions ON attendance_sessions.id = attendance_records.session_id
    WHERE attendance_sessions.section_id = ? AND attendance_records.student_id = ?
    ORDER BY attendance_sessions.session_date`);
  const getMissedCount = database.prepare(`SELECT COUNT(*) AS count FROM missed_topics
    JOIN attendance_sessions ON attendance_sessions.id = missed_topics.session_id
    WHERE attendance_sessions.section_id = ? AND missed_topics.student_id = ?`);

  return roster.map((student) => {
    const history = getHistory.all(section.id, student.id);
    const held = history.length;
    const attended = history.filter((record) => record.status === 'Present' || record.status === 'Late').length;
    const attendancePct = held ? Math.round((attended / held) * 100) : 0;
    const trend = attendanceTrend(history);
    const missedTopics = getMissedCount.get(section.id, student.id).count;
    const prediction = predictAttendance({ attended, total: held, trend, syllabusPct }, missedTopics);
    const falling = held >= 4 && prediction.predicted < attendancePct;
    return {
      id: student.id,
      name: student.name,
      enrollment: student.enrollment,
      attendanceFraction: { attended, held },
      attendancePct,
      missedTopics,
      trend,
      falling,
      lastAttendance: history.at(-1)?.session_date || null,
      predictedAttendance: prediction.predicted,
      modelConfidence: prediction.confidence,
      atRisk: held > 0 && (attended / held < requiredFraction || falling)
    };
  }).filter((student) => student.atRisk)
    .sort((first, second) => first.attendancePct - second.attendancePct || second.missedTopics - first.missedTopics);
}

function getStudentSubjects(studentId) {
  const requiredFraction = Number(database.prepare("SELECT value FROM academic_settings WHERE key = 'required_attendance_fraction'").get()?.value || 0.75);
  const rows = database.prepare(`SELECT sections.id AS sectionId, sections.name AS section, sections.planned_sessions AS plannedSessions,
      courses.id, courses.code, courses.name,
      COUNT(DISTINCT attendance_sessions.id) AS total,
      SUM(CASE WHEN attendance_records.status IN ('Present', 'Late') THEN 1 ELSE 0 END) AS attended
    FROM enrollments JOIN sections ON sections.id = enrollments.section_id
    JOIN courses ON courses.id = sections.course_id
    LEFT JOIN attendance_sessions ON attendance_sessions.section_id = sections.id
    LEFT JOIN attendance_records ON attendance_records.session_id = attendance_sessions.id
      AND attendance_records.student_id = enrollments.student_id
    WHERE enrollments.student_id = ? GROUP BY sections.id ORDER BY courses.name`).all(studentId);
  const getHistory = database.prepare(`SELECT attendance_records.status FROM attendance_records
    JOIN attendance_sessions ON attendance_sessions.id = attendance_records.session_id
    WHERE attendance_sessions.section_id = ? AND attendance_records.student_id = ?
    ORDER BY attendance_sessions.session_date`);
  const getSyllabus = database.prepare(`SELECT COUNT(syllabus_topics.id) AS total,
      SUM(CASE WHEN section_topic_progress.status = 'Covered' THEN 1 ELSE 0 END) AS covered
    FROM sections JOIN syllabus_topics ON syllabus_topics.course_id = sections.course_id
    LEFT JOIN section_topic_progress ON section_topic_progress.section_id = sections.id
      AND section_topic_progress.topic_id = syllabus_topics.id WHERE sections.id = ?`);
  const getMissedCount = database.prepare(`SELECT COUNT(*) AS count FROM missed_topics
    JOIN attendance_sessions ON attendance_sessions.id = missed_topics.session_id
    WHERE attendance_sessions.section_id = ? AND missed_topics.student_id = ?`);

  const subjects = rows.map((row) => {
    const attended = Number(row.attended || 0);
    const total = Number(row.total);
    const percent = total ? Math.round((attended / total) * 100) : 0;
    const classesLeft = Math.max(0, Number(row.plannedSessions) - total);
    const syllabus = getSyllabus.get(row.sectionId);
    const syllabusPct = syllabus.total ? Math.round((Number(syllabus.covered || 0) / syllabus.total) * 100) : 0;
    const trend = attendanceTrend(getHistory.all(row.sectionId, studentId));
    const missedTopicsCount = Number(getMissedCount.get(row.sectionId, studentId).count);
    const prediction = predictAttendance({ attended, total, trend, syllabusPct }, missedTopicsCount);
    return {
      id: row.id,
      sectionId: row.sectionId,
      section: row.section,
      code: row.code,
      name: row.name,
      attended,
      total,
      percent,
      classesLeft,
      safeAbsences: calculateSafeAbsences(attended, total, classesLeft, requiredFraction),
      syllabusPct,
      trend,
      missedTopicsCount,
      predicted: prediction.predicted,
      confidence: prediction.confidence,
      status: !total ? 'No records' : percent >= requiredFraction * 100 ? 'Safe' : 'At risk'
    };
  });
  return { subjects, requiredFraction };
}

function getStudentMissedTopicRows(studentId) {
  const topics = database.prepare(`SELECT missed_topics.id, missed_topics.topic_id AS topicId,
      courses.name AS subject, sections.name AS section,
      syllabus_topics.unit_name AS unit, syllabus_topics.title AS topic, attendance_sessions.session_date AS date,
      recovery_progress.status AS recoveryStatus
    FROM missed_topics JOIN attendance_sessions ON attendance_sessions.id = missed_topics.session_id
    JOIN sections ON sections.id = attendance_sessions.section_id
    JOIN courses ON courses.id = sections.course_id
    JOIN syllabus_topics ON syllabus_topics.id = missed_topics.topic_id
    LEFT JOIN recovery_progress ON recovery_progress.missed_topic_id = missed_topics.id
    WHERE missed_topics.student_id = ? ORDER BY attendance_sessions.session_date DESC, syllabus_topics.position`).all(studentId);
  const getResources = database.prepare(`SELECT id, title, resource_type AS type, url FROM recovery_resources
    WHERE topic_id = ? ORDER BY title`);
  return topics.map((topic) => ({ ...topic, resources: getResources.all(topic.topicId) }));
}

function getStudentCurriculumRows(studentId) {
  return database.prepare(`SELECT sections.id AS sectionId, sections.name AS section, courses.id AS courseId,
      courses.code AS courseCode, courses.name AS course, syllabus_units.id AS unitId,
      syllabus_units.title AS unit, syllabus_units.position AS unitPosition,
      syllabus_topics.id AS topicId, syllabus_topics.title AS topic,
      syllabus_topics.position AS topicPosition, section_topic_progress.status
    FROM enrollments JOIN sections ON sections.id = enrollments.section_id
    JOIN courses ON courses.id = sections.course_id
    LEFT JOIN syllabus_topics ON syllabus_topics.course_id = courses.id
    LEFT JOIN syllabus_units ON syllabus_units.id = syllabus_topics.unit_id
    LEFT JOIN section_topic_progress ON section_topic_progress.section_id = sections.id
      AND section_topic_progress.topic_id = syllabus_topics.id
    WHERE enrollments.student_id = ? ORDER BY courses.name, syllabus_units.position, syllabus_topics.position`).all(studentId);
}

function normalizeAssistantText(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function getAssistantSchedule(user) {
  const today = new Date().toISOString().slice(0, 10);
  const fields = `schedule_items.date, schedule_items.time, schedule_items.end_time AS endTime,
    schedule_items.type, schedule_items.subject, schedule_items.section, schedule_items.room`;
  if (user.role === 'student') {
    return database.prepare(`SELECT ${fields} FROM enrollments
      JOIN sections ON sections.id = enrollments.section_id
      JOIN courses ON courses.id = sections.course_id
      JOIN schedule_items ON schedule_items.section = sections.name COLLATE NOCASE
        AND schedule_items.subject = courses.name COLLATE NOCASE
      WHERE enrollments.student_id = ? AND schedule_items.date >= ? ORDER BY schedule_items.date, schedule_items.time LIMIT 8`)
      .all(user.id, today);
  }
  if (user.role === 'teacher') {
    return database.prepare(`SELECT ${fields} FROM sections
      JOIN courses ON courses.id = sections.course_id
      JOIN schedule_items ON schedule_items.section = sections.name COLLATE NOCASE
        AND schedule_items.subject = courses.name COLLATE NOCASE
      WHERE sections.teacher_id = ? AND schedule_items.date >= ? ORDER BY schedule_items.date, schedule_items.time LIMIT 8`)
      .all(user.id, today);
  }
  return database.prepare(`SELECT ${fields} FROM schedule_items
    WHERE date >= ? ORDER BY date, time LIMIT 8`).all(today);
}

function getAssistantActivityRequests(user) {
  if (user.role === 'student') {
    return database.prepare(`SELECT title, activity_date AS date, status FROM activity_requests
      WHERE student_id = ? ORDER BY created_at DESC LIMIT 20`).all(user.id);
  }
  if (user.role === 'teacher') {
    return database.prepare(`SELECT DISTINCT activity_requests.title, activity_requests.activity_date AS date, activity_requests.status
      FROM activity_requests JOIN activity_request_reviews ON activity_request_reviews.request_id = activity_requests.id
      WHERE activity_request_reviews.reviewer_id = ? ORDER BY activity_requests.activity_date, activity_requests.title LIMIT 30`).all(user.id);
  }
  return database.prepare(`SELECT title, activity_date AS date, status FROM activity_requests
    ORDER BY created_at DESC LIMIT 30`).all();
}

function assistantResponse(category, answer, data = null) {
  return { category, answer, data };
}

function answerAssistantQuestion(rawQuestion, user) {
  const question = normalizeAssistantText(rawQuestion);
  const isAttendanceQuestion = /\b(attendance|attend|absent|absence|safe absences|percentage|percent)\b/.test(question);
  const isRecoveryQuestion = /\b(missed|miss|recover|recovery|topics|topic|study|learning gap)\b/.test(question);
  const isCurriculumQuestion = /\b(syllabus|curriculum|unit|covered|uncovered|coverage)\b/.test(question);
  const isScheduleQuestion = /\b(schedule|calendar|today|upcoming|next class|when is|what time)\b/.test(question);
  const isActivityQuestion = /\b(activity|activities|request|requests|approval|approvals|pending)\b/.test(question);

  if (/^(hi|hello|hey|hiya|good morning|good afternoon)$/.test(question)) {
    return assistantResponse('greeting', `Hello, ${user.session_display_name || user.name}. What would you like to know about your AIRS records?`);
  }

  if (/\b(threshold|requirement|required attendance|policy)\b/.test(question)) {
    const requiredFraction = Number(database.prepare("SELECT value FROM academic_settings WHERE key = 'required_attendance_fraction'").get()?.value || 0.75);
    return assistantResponse('policy', `The current minimum attendance requirement is ${Math.round(requiredFraction * 100)}%.`, { requiredPercent: Math.round(requiredFraction * 100) });
  }

  if (user.role === 'student') {
    const { subjects, requiredFraction } = getStudentSubjects(user.id);
    const normalizedSubjects = subjects.map((subject) => ({ ...subject, normalizedName: normalizeAssistantText(subject.name) }));
    const subject = normalizedSubjects
      .filter((item) => item.normalizedName && question.includes(item.normalizedName))
      .sort((first, second) => second.normalizedName.length - first.normalizedName.length)[0];

    if (subject && isAttendanceQuestion) {
      const answer = subject.total
        ? `${subject.name} (${subject.section}): attended ${subject.attended} of ${subject.total} sessions (${subject.percent}%). ${subject.safeAbsences} safe absences remain; the required threshold is ${Math.round(requiredFraction * 100)}%.`
        : `${subject.name} (${subject.section}) has no recorded attendance sessions yet.`;
      return assistantResponse('attendance', answer, { subject: subject.name, section: subject.section, attended: subject.attended, total: subject.total, percent: subject.percent, safeAbsences: subject.safeAbsences, requiredPercent: Math.round(requiredFraction * 100) });
    }

    if (isAttendanceQuestion) {
      const totals = subjects.reduce((result, item) => ({ attended: result.attended + item.attended, total: result.total + item.total }), { attended: 0, total: 0 });
      const percent = totals.total ? Math.round((totals.attended / totals.total) * 100) : 0;
      const classesLeft = subjects.reduce((total, item) => total + item.classesLeft, 0);
      const safeAbsences = calculateSafeAbsences(totals.attended, totals.total, classesLeft, requiredFraction);
      return assistantResponse('attendance', totals.total
        ? `Overall attendance: ${totals.attended} of ${totals.total} class sessions (${percent}%) across ${subjects.length} subjects. ${safeAbsences} safe absences remain at the ${Math.round(requiredFraction * 100)}% requirement.`
        : 'There are no attendance sessions recorded for your enrolled subjects yet.', { attended: totals.attended, total: totals.total, percent, subjects: subjects.length, safeAbsences, requiredPercent: Math.round(requiredFraction * 100) });
    }

    if (/\b(subjects|courses|enrolled|class list)\b/.test(question)) {
      return assistantResponse('subjects', subjects.length
        ? `You are enrolled in ${subjects.length} subjects: ${subjects.map((item) => `${item.name} (${item.section})`).join('; ')}.`
        : 'There are no subjects enrolled on your account.', subjects.map(({ name, section, percent, attended, total }) => ({ name, section, percent, attended, total })));
    }

    if (isCurriculumQuestion) {
      const curriculumRows = getStudentCurriculumRows(user.id)
        .filter((row) => row.topicId && (!subject || normalizeAssistantText(row.course) === subject.normalizedName));
      const topics = curriculumRows.map((row) => ({ subject: row.course, unit: row.unit, topic: row.topic, status: row.status || 'Uncovered' }));
      const covered = topics.filter((topic) => topic.status === 'Covered');
      const uncovered = topics.filter((topic) => topic.status !== 'Covered');
      const courseLabel = subject ? `${subject.name}: ` : '';
      const answer = topics.length
        ? `${courseLabel}${covered.length} of ${topics.length} syllabus topics are covered. Covered: ${covered.slice(0, 5).map((topic) => topic.topic).join(', ') || 'none'}. Still to cover: ${uncovered.slice(0, 5).map((topic) => topic.topic).join(', ') || 'none'}.`
        : `I found no syllabus topics${subject ? ` for ${subject.name}` : ''} on your enrolled courses.`;
      return assistantResponse('curriculum', answer, { topics, covered: covered.length, total: topics.length, remaining: uncovered.length });
    }

    if (isRecoveryQuestion) {
      let topics = getStudentMissedTopicRows(user.id);
      if (subject) topics = topics.filter((topic) => normalizeAssistantText(topic.subject) === subject.normalizedName);
      const uniqueTopics = [...new Map(topics.map((topic) => [`${normalizeAssistantText(topic.subject)}|${normalizeAssistantText(topic.topic)}`, topic])).values()];
      const details = uniqueTopics.slice(0, 5).map((topic) => `${topic.topic} in ${topic.subject} (${topic.date}; ${topic.recoveryStatus || 'Not started'})`);
      return assistantResponse('recovery', uniqueTopics.length
        ? `I found ${uniqueTopics.length} distinct topics to recover${subject ? ` in ${subject.name}` : ''}. Start with: ${details.join('; ')}.`
        : `I found no missed topics${subject ? ` in ${subject.name}` : ''} on your record.`, uniqueTopics.slice(0, 5));
    }

    if (isScheduleQuestion) {
      const events = getAssistantSchedule(user);
      return assistantResponse('schedule', events.length
        ? `Your next scheduled items are: ${events.slice(0, 5).map((item) => `${item.subject}, ${item.section}, ${item.date} at ${item.time}${item.endTime ? `–${item.endTime}` : ''}, ${item.room}`).join('; ')}.`
        : 'There are no upcoming scheduled classes for your enrolled subjects.', events.slice(0, 5));
    }
  }

  if (user.role === 'teacher') {
    const sections = database.prepare(`SELECT sections.id, sections.name, courses.name AS course, courses.code,
        COUNT(DISTINCT enrollments.student_id) AS rosterSize
      FROM sections JOIN courses ON courses.id = sections.course_id
      LEFT JOIN enrollments ON enrollments.section_id = sections.id
      WHERE sections.teacher_id = ? GROUP BY sections.id ORDER BY courses.name, sections.name`).all(user.id);

    if (isAttendanceQuestion) {
      const namedSections = sections.filter((item) => question.includes(normalizeAssistantText(item.name)));
      const namedCourses = sections.filter((item) => {
        const terms = [item.course, ...String(item.code || '').split('-')].map(normalizeAssistantText).filter((term) => term.length > 1);
        return terms.some((term) => question.includes(term));
      });
      const selectedSections = namedSections.length
        ? namedSections.filter((item) => !namedCourses.length || namedCourses.includes(item))
        : namedCourses.length ? namedCourses : sections;
      const sectionIds = selectedSections.map((item) => item.id);
      const totals = sectionIds.length
        ? database.prepare(`SELECT COUNT(attendance_records.student_id) AS records,
            SUM(CASE WHEN attendance_records.status = 'Present' THEN 1 ELSE 0 END) AS present,
            SUM(CASE WHEN attendance_records.status = 'Late' THEN 1 ELSE 0 END) AS late,
            SUM(CASE WHEN attendance_records.status = 'Absent' THEN 1 ELSE 0 END) AS absent
          FROM attendance_sessions JOIN attendance_records ON attendance_records.session_id = attendance_sessions.id
          WHERE attendance_sessions.section_id IN (${sectionIds.map(() => '?').join(',')})`).get(...sectionIds)
        : { records: 0, present: 0, late: 0, absent: 0 };
      const records = Number(totals.records || 0);
      const present = Number(totals.present || 0);
      const late = Number(totals.late || 0);
      const absent = Number(totals.absent || 0);
      const attended = present + late;
      const percent = records ? Math.round((attended / records) * 100) : 0;
      const matchedCourse = namedCourses.length ? namedCourses[0].course : null;
      const label = namedSections.length
        ? selectedSections.map((item) => `${item.course} (${item.name})`).join(', ')
        : matchedCourse ? `${matchedCourse} across ${selectedSections.length} sections` : `${sectionIds.length} assigned sections`;
      return assistantResponse('attendance', records
        ? `${label} attendance: ${percent}% (${attended} of ${records} attendance marks show present or late; ${absent} are absent).`
        : `No attendance marks are recorded for ${label}.`, { course: matchedCourse, sections: selectedSections.map(({ course, name }) => ({ course, name })), records, present, late, absent, attended, percent });
    }

    if (/\b(section|sections|teach|teaching|assigned)\b/.test(question)) {
      const rosterCount = sections.reduce((total, section) => total + Number(section.rosterSize), 0);
      return assistantResponse('sections', `You teach ${sections.length} sections with ${rosterCount} enrolled student places: ${sections.map((section) => `${section.course} (${section.name}, ${section.rosterSize} students)`).join('; ')}.`, sections);
    }

    if (/\b(risk|at risk|follow up|follow-up|declining)\b/.test(question)) {
      const students = sections.flatMap((section) => getAtRiskStudents(section).map((student) => ({ ...student, section: section.name, course: section.course })));
      return assistantResponse('at-risk', students.length
        ? `${students.length} students are flagged across your sections. The three lowest attendance records are: ${students.slice(0, 3).map((student) => `${student.name} (${student.course} ${student.section}, ${student.attendancePct}%, ${student.attendanceFraction.attended}/${student.attendanceFraction.held})`).join('; ')}.`
        : 'No students are currently flagged for attendance follow-up in your sections.', students.slice(0, 10));
    }

    if (isScheduleQuestion) {
      const events = getAssistantSchedule(user);
      return assistantResponse('schedule', events.length
        ? `Your next assigned classes are: ${events.slice(0, 5).map((item) => `${item.subject}, ${item.section}, ${item.date} at ${item.time}${item.endTime ? `–${item.endTime}` : ''}, ${item.room}`).join('; ')}.`
        : 'There are no upcoming assigned classes on your schedule.', events.slice(0, 5));
    }
  }

  if (user.role === 'admin') {
    if (isAttendanceQuestion) {
      const activeCourses = database.prepare(`SELECT courses.id, courses.name, courses.code,
          COUNT(DISTINCT sections.id) AS sections
        FROM courses JOIN sections ON sections.course_id = courses.id
        GROUP BY courses.id ORDER BY courses.name`).all();
      const course = activeCourses.find((item) => {
        const courseName = normalizeAssistantText(item.name);
        const codeTerms = String(item.code || '').split('-').map(normalizeAssistantText).filter((term) => term.length > 1);
        return question.includes(courseName) || codeTerms.some((term) => term.length > 2
          ? question.includes(term)
          : question.split(' ').includes(term));
      });
      const totals = course
        ? database.prepare(`SELECT COUNT(attendance_records.student_id) AS records,
            SUM(CASE WHEN attendance_records.status = 'Present' THEN 1 ELSE 0 END) AS present,
            SUM(CASE WHEN attendance_records.status = 'Late' THEN 1 ELSE 0 END) AS late,
            SUM(CASE WHEN attendance_records.status = 'Absent' THEN 1 ELSE 0 END) AS absent
          FROM sections JOIN attendance_sessions ON attendance_sessions.section_id = sections.id
          JOIN attendance_records ON attendance_records.session_id = attendance_sessions.id
          WHERE sections.course_id = ?`).get(course.id)
        : database.prepare(`SELECT COUNT(*) AS records,
          SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS present,
          SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END) AS late,
          SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) AS absent
        FROM attendance_records`).get();
      const records = Number(totals.records || 0);
      const present = Number(totals.present || 0);
      const late = Number(totals.late || 0);
      const absent = Number(totals.absent || 0);
      const attended = present + late;
      const percent = records ? Math.round((attended / records) * 100) : 0;
      const label = course ? `${course.name} across ${course.sections} sections` : 'Institution-wide';
      return assistantResponse('attendance', records
        ? `${label} attendance: ${percent}% (${attended} of ${records} attendance marks show present or late; ${absent} are absent).`
        : `There are no attendance marks recorded${course ? ` for ${course.name}` : ''} yet.`, { course: course?.name || null, sections: course?.sections || null, records, present, late, absent, attended, percent });
    }
    if (/\b(risk|at risk|follow up|follow-up|declining)\b/.test(question)) {
      const sections = database.prepare(`SELECT sections.id, sections.name, courses.name AS course
        FROM sections JOIN courses ON courses.id = sections.course_id ORDER BY courses.name, sections.name`).all();
      const students = sections.flatMap((section) => getAtRiskStudents(section)
        .map((student) => ({ ...student, section: section.name, course: section.course })))
        .sort((first, second) => first.attendancePct - second.attendancePct);
      return assistantResponse('at-risk', students.length
        ? `${students.length} students are flagged institution-wide. The three lowest attendance records are: ${students.slice(0, 3).map((student) => `${student.name} (${student.course} ${student.section}, ${student.attendancePct}%, ${student.attendanceFraction.attended}/${student.attendanceFraction.held})`).join('; ')}.`
        : 'No students are currently flagged for attendance follow-up.', { count: students.length, students: students.slice(0, 10) });
    }
    if (/\b(course|courses|subject|subjects)\b/.test(question)) {
      const courses = database.prepare(`SELECT DISTINCT courses.name, courses.code, courses.department FROM courses
        JOIN sections ON sections.course_id = courses.id ORDER BY courses.name`).all();
      return assistantResponse('courses', `There are ${courses.length} courses in AIRS: ${courses.map((course) => course.name).join(', ')}.`, courses);
    }
    if (/\b(student|students|faculty|teacher|teachers|users|accounts|sections)\b/.test(question)) {
      const counts = database.prepare('SELECT role, COUNT(*) AS count FROM users GROUP BY role').all();
      const totals = Object.fromEntries(counts.map((row) => [row.role, Number(row.count)]));
      const sections = Number(database.prepare('SELECT COUNT(*) AS count FROM sections').get().count);
      return assistantResponse('institution', `AIRS currently has ${totals.student || 0} student accounts, ${totals.teacher || 0} faculty accounts, ${totals.admin || 0} admin accounts, and ${sections} sections.`, { ...totals, sections });
    }
  }

  if (isScheduleQuestion) {
    const events = getAssistantSchedule(user);
    return assistantResponse('schedule', events.length
      ? `Upcoming scheduled items: ${events.slice(0, 5).map((item) => `${item.subject}, ${item.section}, ${item.date} at ${item.time}`).join('; ')}.`
      : 'There are no upcoming scheduled items.', events.slice(0, 5));
  }

  if (isActivityQuestion) {
    const requests = getAssistantActivityRequests(user);
    const statusCounts = requests.reduce((counts, item) => ({ ...counts, [item.status]: (counts[item.status] || 0) + 1 }), {});
    return assistantResponse('activities', requests.length
      ? `I found ${requests.length} activity requests: ${statusCounts.Pending || 0} pending, ${statusCounts.Approved || 0} approved, and ${statusCounts.Declined || 0} declined.`
      : 'There are no activity requests in your role-scoped queue.', statusCounts);
  }

  if (/\b(who am i|my name|my profile|my role)\b/.test(question)) {
    return assistantResponse('profile', `You are signed in as ${user.session_display_name || user.name}, in the ${user.role} workspace.`, { name: user.session_display_name || user.name, role: user.role });
  }

  return assistantResponse('unsupported', 'I can answer questions from your AIRS records: subject attendance, overall attendance, missed topics, class schedules, activity requests, and role-specific sections or institution counts. I cannot answer general web questions without an AI knowledge service connected.');
}

const apiRouter = createRouter();
registerAuthRoutes(apiRouter, {
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
});

async function handleApi(request, response, url) {
  const routed = await apiRouter.dispatch(request, response, url, { send, readJson, getSession, requireRole });
  if (routed) return;

  const user = getSession(request);
  if (!user) return send(response, 401, errorResponse(401, 'Please sign in to continue.'));

  if (request.method === 'POST' && url.pathname === '/api/assistant/ask') {
    const body = await readJson(request);
    const question = String(body.question || '').trim();
    if (!question || question.length > 500) return send(response, 400, { error: 'Ask a question up to 500 characters.' });
    return send(response, 200, answerAssistantQuestion(question, user));
  }

  if (request.method === 'GET' && url.pathname === '/api/attendance/sections') {
    if (!requireRole(user, ['teacher'])) return send(response, 403, { error: 'Only faculty can access attendance rosters.' });
    const sections = database.prepare(`SELECT sections.id, sections.name, courses.name AS course, courses.code AS courseCode,
      COUNT(DISTINCT enrollments.student_id) AS rosterSize, MAX(attendance_sessions.session_date) AS latestSessionDate
      FROM sections JOIN courses ON courses.id = sections.course_id
      LEFT JOIN enrollments ON enrollments.section_id = sections.id
      LEFT JOIN attendance_sessions ON attendance_sessions.section_id = sections.id
      WHERE sections.teacher_id = ? GROUP BY sections.id ORDER BY sections.name`).all(user.id);
    return send(response, 200, { sections });
  }

  if (request.method === 'GET' && url.pathname === '/api/faculty/dashboard') {
    if (!requireRole(user, ['teacher'])) return send(response, 403, { error: 'Faculty access required.' });
    const sections = database.prepare(`SELECT sections.id, sections.name, courses.name AS course,
        COUNT(DISTINCT enrollments.student_id) AS rosterSize,
        MAX(attendance_sessions.session_date) AS latestSessionDate
      FROM sections JOIN courses ON courses.id = sections.course_id
      LEFT JOIN enrollments ON enrollments.section_id = sections.id
      LEFT JOIN attendance_sessions ON attendance_sessions.section_id = sections.id
      WHERE sections.teacher_id = ? GROUP BY sections.id ORDER BY sections.name`).all(user.id);
    const today = new Date().toISOString().slice(0, 10);
    const schedule = database.prepare(`SELECT * FROM schedule_items WHERE faculty = ? COLLATE NOCASE
      AND date >= ? ORDER BY date, time LIMIT 12`).all(user.name, today);
    const atRiskStudents = sections.flatMap((section) => getAtRiskStudents(section)
      .map((student) => ({ ...student, section: section.name, course: section.course })));
    return send(response, 200, {
      today,
      sections,
      schedule,
      metrics: {
        assignedSections: sections.length,
        students: sections.reduce((count, section) => count + Number(section.rosterSize), 0),
        atRiskStudents: atRiskStudents.length,
        decliningAttendance: atRiskStudents.filter((student) => student.falling).length
      },
      atRiskStudents
    });
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/dashboard') {
    if (!requireRole(user, ['admin'])) return send(response, 403, { error: 'Administrator access required.' });
    const today = new Date().toISOString().slice(0, 10);
    const userCounts = database.prepare('SELECT role, COUNT(*) AS count FROM users GROUP BY role').all();
    const countsByRole = Object.fromEntries(userCounts.map((row) => [row.role, Number(row.count)]));
    const availabilityByStatus = database.prepare('SELECT status, COUNT(*) AS count FROM availability_requests GROUP BY status').all();
    const availabilityCounts = Object.fromEntries(availabilityByStatus.map((row) => [row.status, Number(row.count)]));
    const activityByStatus = database.prepare('SELECT status, COUNT(*) AS count FROM activity_requests GROUP BY status').all();
    const activityCounts = Object.fromEntries(activityByStatus.map((row) => [row.status, Number(row.count)]));
    const sections = database.prepare(`SELECT sections.id, sections.name, courses.id AS courseId, courses.name AS course,
        courses.code AS courseCode, courses.department, sections.teacher_id AS facultyId, users.name AS faculty
      FROM sections JOIN courses ON courses.id = sections.course_id JOIN users ON users.id = sections.teacher_id
      ORDER BY courses.name, sections.name`).all();
    const attendanceByCourse = database.prepare(`SELECT courses.id AS courseId, courses.code, courses.name AS course,
        courses.department, COUNT(DISTINCT attendance_sessions.id) AS held,
        SUM(CASE WHEN attendance_records.status IN ('Present', 'Late') THEN 1 ELSE 0 END) AS attended,
        COUNT(DISTINCT sections.id) AS sections
      FROM sections JOIN courses ON courses.id = sections.course_id
      LEFT JOIN attendance_sessions ON attendance_sessions.section_id = sections.id
      LEFT JOIN attendance_records ON attendance_records.session_id = attendance_sessions.id
      GROUP BY courses.id ORDER BY courses.name`).all().map((row) => ({
      ...row,
      held: Number(row.held),
      attended: Number(row.attended || 0),
      percent: row.held ? Math.round((Number(row.attended || 0) / Number(row.held)) * 100) : 0
    }));
    const departmentRows = database.prepare(`SELECT courses.department,
        COUNT(DISTINCT sections.id) AS sections, COUNT(DISTINCT enrollments.student_id) AS students,
        COUNT(DISTINCT sections.teacher_id) AS faculty
      FROM courses LEFT JOIN sections ON sections.course_id = courses.id
      LEFT JOIN enrollments ON enrollments.section_id = sections.id
      GROUP BY courses.department ORDER BY courses.department`).all();
    const syllabusByDepartment = database.prepare(`SELECT courses.department, COUNT(syllabus_topics.id) AS topics,
        SUM(CASE WHEN section_topic_progress.status = 'Covered' THEN 1 ELSE 0 END) AS covered
      FROM sections JOIN courses ON courses.id = sections.course_id
      JOIN syllabus_topics ON syllabus_topics.course_id = courses.id
      LEFT JOIN section_topic_progress ON section_topic_progress.section_id = sections.id
        AND section_topic_progress.topic_id = syllabus_topics.id
      GROUP BY courses.department ORDER BY courses.department`).all().map((row) => ({
      ...row,
      topics: Number(row.topics),
      covered: Number(row.covered || 0),
      percent: row.topics ? Math.round((Number(row.covered || 0) / Number(row.topics)) * 100) : 0
    }));
    const atRiskStudents = sections.flatMap((section) => getAtRiskStudents(section)
      .map((student) => ({ ...student, section: section.name, course: section.course, faculty: section.faculty })));
    const auditPreview = database.prepare(`SELECT audit_events.id, audit_events.action, audit_events.details,
        audit_events.created_at, users.name AS actor
      FROM audit_events JOIN users ON users.id = audit_events.actor_id
      ORDER BY audit_events.created_at DESC LIMIT 6`).all();
    const activeSessions = database.prepare('SELECT COUNT(*) AS count FROM sessions WHERE expires_at > ?').get(Date.now()).count;
    const sessionsMissingAttendance = database.prepare(`SELECT COUNT(*) AS count FROM attendance_sessions
      WHERE NOT EXISTS (SELECT 1 FROM attendance_records WHERE attendance_records.session_id = attendance_sessions.id)`).get().count;
    const activityParticipation = database.prepare('SELECT COUNT(DISTINCT student_id) AS count FROM activity_requests').get().count;
    const activityTotal = database.prepare('SELECT COUNT(*) AS count FROM activity_requests').get().count;
    const schedules = database.prepare('SELECT * FROM schedule_items WHERE date >= ? ORDER BY date, time LIMIT 12').all(today);
    const totalHeld = attendanceByCourse.reduce((sum, row) => sum + row.held, 0);
    const totalAttended = attendanceByCourse.reduce((sum, row) => sum + row.attended, 0);
    const studentCount = countsByRole.student || 0;
    const facultyCount = countsByRole.teacher || 0;
    return send(response, 200, {
      today,
      metrics: {
        students: studentCount,
        faculty: facultyCount,
        sections: sections.length,
        attendancePercent: totalHeld ? Math.round((totalAttended / totalHeld) * 100) : null,
        atRisk: atRiskStudents.length,
        pendingAvailability: availabilityCounts.Pending || 0,
        pendingActivities: activityCounts.Pending || 0
      },
      sections,
      departments: departmentRows.map((row) => ({ ...row, sections: Number(row.sections), students: Number(row.students), faculty: Number(row.faculty) })),
      syllabusByDepartment,
      attendanceByCourse,
      atRiskStudents,
      availabilityCounts,
      activityCounts,
      schedule: schedules,
      auditPreview,
      activeSessions,
      sessionsMissingAttendance: Number(sessionsMissingAttendance),
      activityParticipation: Number(activityParticipation),
      activityTotal: Number(activityTotal)
    });
  }

  const facultyAtRiskMatch = url.pathname.match(/^\/api\/faculty\/sections\/([a-zA-Z0-9-]+)\/at-risk$/);
  if (request.method === 'GET' && facultyAtRiskMatch) {
    if (!requireRole(user, ['teacher'])) return send(response, 403, { error: 'Faculty access required.' });
    const section = database.prepare(`SELECT sections.id, sections.name, courses.name AS course
      FROM sections JOIN courses ON courses.id = sections.course_id
      WHERE sections.id = ? AND sections.teacher_id = ?`).get(facultyAtRiskMatch[1], user.id);
    if (!section) return send(response, 404, { error: 'Section not found.' });
    const requiredFraction = Number(database.prepare("SELECT value FROM academic_settings WHERE key = 'required_attendance_fraction'").get()?.value || 0.75);
    return send(response, 200, { section, requiredFraction, students: getAtRiskStudents(section) });
  }

  const attendanceSectionMatch = url.pathname.match(/^\/api\/attendance\/sections\/([a-zA-Z0-9-]+)$/);
  if (request.method === 'GET' && attendanceSectionMatch) {
    if (!requireRole(user, ['teacher'])) return send(response, 403, { error: 'Only faculty can access attendance rosters.' });
    const section = database.prepare(`SELECT sections.id, sections.name, sections.course_id, courses.name AS course, courses.code AS courseCode
      FROM sections JOIN courses ON courses.id = sections.course_id
      WHERE sections.id = ? AND sections.teacher_id = ?`).get(attendanceSectionMatch[1], user.id);
    if (!section) return send(response, 404, { error: 'Section not found.' });
    const date = url.searchParams.get('date') || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return send(response, 400, { error: 'Choose a valid attendance date.' });
    const session = database.prepare('SELECT id, topic_id FROM attendance_sessions WHERE section_id = ? AND session_date = ?').get(section.id, date);
    const topicIds = session
      ? database.prepare('SELECT topic_id FROM session_topics WHERE session_id = ? ORDER BY topic_id').all(session.id).map((row) => row.topic_id)
      : [];
    const students = database.prepare(`SELECT users.id, users.name, users.enrollment,
      attendance_records.status
      FROM enrollments JOIN users ON users.id = enrollments.student_id
      LEFT JOIN attendance_records ON attendance_records.student_id = users.id AND attendance_records.session_id = ?
      WHERE enrollments.section_id = ? ORDER BY users.name`).all(session?.id || '', section.id);
    const topics = database.prepare(`SELECT id, unit_name AS unit, title FROM syllabus_topics
      WHERE course_id = ? ORDER BY position`).all(section.course_id);
    return send(response, 200, { section, date, sessionId: session?.id || null, topicIds, topics, students });
  }

  if (request.method === 'POST' && attendanceSectionMatch) {
    if (!requireRole(user, ['teacher'])) return send(response, 403, { error: 'Only faculty can submit attendance.' });
    const section = database.prepare('SELECT id, course_id FROM sections WHERE id = ? AND teacher_id = ?').get(attendanceSectionMatch[1], user.id);
    if (!section) return send(response, 404, { error: 'Section not found.' });
    const body = await readJson(request);
    const date = String(body.date || '');
    const topicIds = Array.isArray(body.topicIds)
      ? [...new Set(body.topicIds.map((topicId) => String(topicId)))]
      : body.topicId ? [String(body.topicId)] : [];
    const attendance = Array.isArray(body.attendance) ? body.attendance : [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !attendance.length) {
      return send(response, 400, { error: 'Choose a valid date and record attendance for the section roster.' });
    }
    const validTopicCount = topicIds.length
      ? database.prepare(`SELECT COUNT(*) AS count FROM syllabus_topics WHERE course_id = ? AND id IN (${topicIds.map(() => '?').join(',')})`).get(section.course_id, ...topicIds).count
      : 0;
    if (validTopicCount !== topicIds.length) {
      return send(response, 400, { error: 'Choose topics from this course syllabus.' });
    }
    const roster = database.prepare('SELECT student_id FROM enrollments WHERE section_id = ?').all(section.id).map((row) => row.student_id);
    const submittedIds = attendance.map((record) => String(record.studentId || ''));
    if (attendance.some((record) => !['Present', 'Late', 'Absent'].includes(record.status))
      || new Set(submittedIds).size !== submittedIds.length
      || roster.length !== submittedIds.length
      || roster.some((studentId) => !submittedIds.includes(studentId))) {
      return send(response, 400, { error: 'Submit exactly one valid attendance status for every enrolled student.' });
    }

    const timestamp = new Date().toISOString();
    database.exec('BEGIN IMMEDIATE');
    try {
      let session = database.prepare('SELECT id FROM attendance_sessions WHERE section_id = ? AND session_date = ?').get(section.id, date);
      if (session) {
        database.prepare('UPDATE attendance_sessions SET topic_id = ?, teacher_id = ? WHERE id = ?').run(topicIds[0] || null, user.id, session.id);
      } else {
        session = { id: randomBytes(16).toString('hex') };
        database.prepare(`INSERT INTO attendance_sessions (id, section_id, teacher_id, session_date, topic_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`).run(session.id, section.id, user.id, date, topicIds[0] || null, timestamp);
      }
      database.prepare('DELETE FROM session_topics WHERE session_id = ?').run(session.id);
      const insertSessionTopic = database.prepare('INSERT INTO session_topics (session_id, topic_id) VALUES (?, ?)');
      for (const topicId of topicIds) insertSessionTopic.run(session.id, topicId);
      const upsertAttendance = database.prepare(`INSERT INTO attendance_records (session_id, student_id, status, marked_by, marked_at)
        VALUES (?, ?, ?, ?, ?) ON CONFLICT(session_id, student_id) DO UPDATE SET
        status = excluded.status, marked_by = excluded.marked_by, marked_at = excluded.marked_at`);
      for (const record of attendance) upsertAttendance.run(session.id, record.studentId, record.status, user.id, timestamp);
      database.prepare(`DELETE FROM missed_topics WHERE session_id = ? AND (
        student_id IN (SELECT student_id FROM attendance_records WHERE session_id = ? AND status <> 'Absent')
        OR topic_id NOT IN (SELECT topic_id FROM session_topics WHERE session_id = ?)
      )`).run(session.id, session.id, session.id);
      database.prepare(`INSERT OR IGNORE INTO missed_topics (id, session_id, student_id, topic_id, created_at)
        SELECT lower(hex(randomblob(16))), attendance_records.session_id, attendance_records.student_id, session_topics.topic_id, ?
        FROM attendance_records JOIN session_topics ON session_topics.session_id = attendance_records.session_id
        WHERE attendance_records.session_id = ? AND attendance_records.status = 'Absent'`).run(timestamp, session.id);
      database.prepare(`INSERT OR IGNORE INTO recovery_progress (missed_topic_id, status, started_at, completed_at)
        SELECT id, 'Not started', NULL, NULL FROM missed_topics WHERE session_id = ?`).run(session.id);
      const missedTopicCount = database.prepare('SELECT COUNT(*) AS count FROM missed_topics WHERE session_id = ?').get(session.id).count;
      insertAudit.run(randomBytes(16).toString('hex'), user.id, 'Attendance submitted', session.id, JSON.stringify({ sectionId: section.id, date, studentCount: attendance.length, topicIds }), timestamp);
      database.exec('COMMIT');
      return send(response, 200, { ok: true, sessionId: session.id, date, studentCount: attendance.length, missedTopicCount });
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  if (request.method === 'GET' && url.pathname === '/api/student/dashboard') {
    if (!requireRole(user, ['student'])) return send(response, 403, { error: 'Student access required.' });
    const { subjects, requiredFraction } = getStudentSubjects(user.id);
    const missedTopics = getStudentMissedTopicRows(user.id);
    const totals = subjects.reduce((result, subject) => ({
      attended: result.attended + subject.attended,
      held: result.held + subject.total,
      classesLeft: result.classesLeft + subject.classesLeft
    }), { attended: 0, held: 0, classesLeft: 0 });
    const predictions = subjects.map((subject) => subject.predicted);
    const overallAttendancePct = totals.held ? Math.round((totals.attended / totals.held) * 100) : 0;
    const predictedAttendance = predictions.length ? Math.round(predictions.reduce((sum, value) => sum + value, 0) / predictions.length) : 0;
    return send(response, 200, {
      profile: { name: user.session_display_name || user.name, email: user.email, department: user.department, section: user.section },
      requiredFraction,
      attendance: {
        attended: totals.attended,
        held: totals.held,
        percent: overallAttendancePct,
        missedSessions: Math.max(0, totals.held - totals.attended),
        safeAbsences: calculateSafeAbsences(totals.attended, totals.held, totals.classesLeft, requiredFraction),
        status: !totals.held ? 'No records' : totals.attended / totals.held >= requiredFraction ? 'On track' : 'At risk'
      },
      subjects,
      intelligence: {
        gaps: missedTopics.length,
        atRiskSubjects: subjects.filter((subject) => subject.status === 'At risk').length,
        predictedAttendance
      },
      missedTopics: missedTopics.slice(0, 5)
    });
  }

  if (request.method === 'GET' && url.pathname === '/api/student/attendance') {
    if (!requireRole(user, ['student'])) return send(response, 403, { error: 'Student access required.' });
    return send(response, 200, getStudentSubjects(user.id));
  }

  if (request.method === 'GET' && url.pathname === '/api/student/curriculum') {
    if (!requireRole(user, ['student'])) return send(response, 403, { error: 'Student access required.' });
    const rows = getStudentCurriculumRows(user.id);
    const courses = new Map();
    for (const row of rows) {
      if (!courses.has(row.courseId)) {
        courses.set(row.courseId, { id: row.courseId, code: row.courseCode, name: row.course, section: row.section, units: [] });
      }
      if (!row.topicId) continue;
      const course = courses.get(row.courseId);
      const unitId = row.unitId || `legacy-unit-${row.courseId}-${row.unit}`;
      let unit = course.units.find((item) => item.id === unitId);
      if (!unit) {
        unit = { id: unitId, title: row.unit, topics: [] };
        course.units.push(unit);
      }
      unit.topics.push({ id: row.topicId, title: row.topic, status: row.status || 'Uncovered' });
    }
    const items = [...courses.values()].map((course) => {
      const topics = course.units.flatMap((unit) => unit.topics);
      const completed = topics.filter((topic) => topic.status === 'Covered').length;
      return { ...course, completed, total: topics.length, progress: topics.length ? Math.round((completed / topics.length) * 100) : 0 };
    });
    return send(response, 200, { courses: items });
  }

  if (request.method === 'GET' && url.pathname === '/api/student/recovery') {
    if (!requireRole(user, ['student'])) return send(response, 403, { error: 'Student access required.' });
    return send(response, 200, { topics: getStudentMissedTopicRows(user.id) });
  }

  if (request.method === 'GET' && url.pathname === '/api/student/missed-topics') {
    if (!requireRole(user, ['student'])) return send(response, 403, { error: 'Student access required.' });
    return send(response, 200, { topics: getStudentMissedTopicRows(user.id) });
  }

  if (request.method === 'GET' && url.pathname === '/api/attendance-policy') {
    const requiredFraction = Number(database.prepare("SELECT value FROM academic_settings WHERE key = 'required_attendance_fraction'").get()?.value || 0.75);
    return send(response, 200, { requiredFraction });
  }

  if (request.method === 'GET' && url.pathname === '/api/activity-requests') {
    let rows;
    if (user.role === 'student') {
      rows = database.prepare(`SELECT activity_requests.*, users.name AS student_name FROM activity_requests
        JOIN users ON users.id = activity_requests.student_id WHERE activity_requests.student_id = ?
        ORDER BY activity_requests.created_at DESC`).all(user.id);
    } else if (user.role === 'teacher') {
      rows = database.prepare(`SELECT DISTINCT activity_requests.*, students.name AS student_name FROM activity_requests
        JOIN users AS students ON students.id = activity_requests.student_id
        JOIN activity_request_reviews ON activity_request_reviews.request_id = activity_requests.id
        WHERE activity_request_reviews.reviewer_id = ? ORDER BY activity_requests.created_at DESC`).all(user.id);
    } else {
      rows = database.prepare(`SELECT activity_requests.*, users.name AS student_name FROM activity_requests
        JOIN users ON users.id = activity_requests.student_id ORDER BY activity_requests.created_at DESC`).all();
    }
    return send(response, 200, { requests: rows.map(parseActivityRequest) });
  }

  if (request.method === 'POST' && url.pathname === '/api/activity-requests') {
    if (!requireRole(user, ['student'])) return send(response, 403, { error: 'Only students can request activity conflict review.' });
    const body = await readJson(request);
    const title = String(body.title || '').trim();
    const date = String(body.date || '');
    const startTime = String(body.startTime || '');
    const endTime = String(body.endTime || '');
    const reason = String(body.reason || '').trim();
    if (!title || title.length > 120 || !/^\d{4}-\d{2}-\d{2}$/.test(date)
      || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)
      || endTime <= startTime || !reason || reason.length > 500) {
      return send(response, 400, { error: 'Provide an activity title, valid date and time range, and a reason up to 500 characters.' });
    }

    const enrolledSections = new Set(database.prepare(`SELECT sections.name FROM enrollments
      JOIN sections ON sections.id = enrollments.section_id WHERE enrollments.student_id = ?`).all(user.id).map((row) => row.name));
    const scheduledClasses = database.prepare(`SELECT schedule_items.*, faculty.id AS faculty_id, faculty.name AS faculty_name
      FROM schedule_items LEFT JOIN users AS faculty ON faculty.role = 'teacher'
        AND faculty.name = schedule_items.faculty COLLATE NOCASE
      WHERE schedule_items.date = ? AND schedule_items.type = 'Class'`).all(date)
      .filter((item) => enrolledSections.has(item.section));
    const overlaps = (classStart, classEnd) => startTime < classEnd && endTime > classStart;
    const classConflicts = scheduledClasses.filter((item) => item.end_time && overlaps(item.time, item.end_time));
    const unverifiedConflicts = scheduledClasses.filter((item) => !item.end_time && item.time < endTime);
    const affectedClassIds = new Set([...classConflicts, ...unverifiedConflicts].map((item) => item.faculty_id).filter(Boolean));
    const unavailableFaculty = affectedClassIds.size
      ? database.prepare(`SELECT availability_requests.user_id, availability_requests.start_date,
          availability_requests.end_date, availability_requests.status, users.name
        FROM availability_requests JOIN users ON users.id = availability_requests.user_id
        WHERE availability_requests.user_id IN (${[...affectedClassIds].map(() => '?').join(',')})
          AND availability_requests.start_date <= ? AND availability_requests.end_date >= ?
          AND availability_requests.status IN ('Pending', 'Approved')`).all(...affectedClassIds, date, date)
      : [];
    const unavailableIds = new Set(unavailableFaculty.map((item) => item.user_id));
    const conflicts = [
      ...classConflicts.map((item) => ({ type: 'class', scheduleId: item.id, subject: item.subject, section: item.section, faculty: item.faculty_name || item.faculty, startTime: item.time, endTime: item.end_time })),
      ...unverifiedConflicts.map((item) => ({ type: 'schedule-time-missing', scheduleId: item.id, subject: item.subject, section: item.section, faculty: item.faculty_name || item.faculty, startTime: item.time })),
      ...unavailableFaculty.map((item) => ({ type: 'faculty-unavailable', faculty: item.name, startDate: item.start_date, endDate: item.end_date, status: item.status }))
    ];
    const reviewerIds = new Set();
    const adminId = database.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY CASE WHEN email LIKE '%@demo.airs.local' THEN 0 ELSE 1 END, id LIMIT 1").get()?.id;
    for (const item of [...classConflicts, ...unverifiedConflicts]) {
      if (item.faculty_id && !unavailableIds.has(item.faculty_id)) reviewerIds.add(item.faculty_id);
      else if (adminId) reviewerIds.add(adminId);
    }

    const id = randomBytes(16).toString('hex');
    const createdAt = new Date().toISOString();
    const status = reviewerIds.size ? 'Pending' : 'Approved';
    database.exec('BEGIN IMMEDIATE');
    try {
      database.prepare(`INSERT INTO activity_requests (id, student_id, title, activity_date, start_time, end_time,
        reason, status, conflicts_json, created_at, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, user.id, title, date, startTime, endTime, reason, status, JSON.stringify(conflicts), createdAt, status === 'Approved' ? createdAt : null);
      const insertReview = database.prepare(`INSERT INTO activity_request_reviews (request_id, reviewer_id, status)
        VALUES (?, ?, 'Pending')`);
      for (const reviewerId of reviewerIds) insertReview.run(id, reviewerId);
      insertAudit.run(randomBytes(16).toString('hex'), user.id, 'Activity request submitted', id, JSON.stringify({ date, startTime, endTime, conflictCount: conflicts.length, reviewers: [...reviewerIds] }), createdAt);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return send(response, 201, { request: parseActivityRequest(getActivityRequestById.get(id)), autoApproved: status === 'Approved' });
  }

  const activityReviewMatch = url.pathname.match(/^\/api\/activity-requests\/([a-f0-9]+)\/review$/);
  if (request.method === 'POST' && activityReviewMatch) {
    if (!requireRole(user, ['teacher', 'admin'])) return send(response, 403, { error: 'Faculty or administrator access required.' });
    const body = await readJson(request);
    const decision = String(body.status || '');
    if (!['Approved', 'Declined'].includes(decision)) return send(response, 400, { error: 'Choose approve or decline.' });
    const existing = getActivityRequestById.get(activityReviewMatch[1]);
    if (!existing) return send(response, 404, { error: 'Activity request not found.' });
    if (existing.status !== 'Pending') return send(response, 409, { error: 'This activity request has already been resolved.' });
    database.exec('BEGIN IMMEDIATE');
    try {
      const review = database.prepare(`SELECT status FROM activity_request_reviews
        WHERE request_id = ? AND reviewer_id = ?`).get(existing.id, user.id);
      if (!review) {
        database.exec('ROLLBACK');
        return send(response, 403, { error: 'This request is not assigned to your account.' });
      }
      if (review.status !== 'Pending') {
        database.exec('ROLLBACK');
        return send(response, 409, { error: 'You have already reviewed this activity request.' });
      }
      const reviewedAt = new Date().toISOString();
      database.prepare(`UPDATE activity_request_reviews SET status = ?, decision_note = ?, reviewed_at = ?
        WHERE request_id = ? AND reviewer_id = ? AND status = 'Pending'`)
        .run(decision, String(body.note || '').trim() || null, reviewedAt, existing.id, user.id);
      const declined = database.prepare(`SELECT 1 FROM activity_request_reviews WHERE request_id = ? AND status = 'Declined'`).get(existing.id);
      const pending = database.prepare(`SELECT 1 FROM activity_request_reviews WHERE request_id = ? AND status = 'Pending'`).get(existing.id);
      const requestStatus = declined ? 'Declined' : pending ? 'Pending' : 'Approved';
      database.prepare('UPDATE activity_requests SET status = ?, reviewed_at = ? WHERE id = ?')
        .run(requestStatus, requestStatus === 'Pending' ? null : reviewedAt, existing.id);
      insertAudit.run(randomBytes(16).toString('hex'), user.id, `Activity request ${decision.toLowerCase()}`, existing.id, JSON.stringify({ note: String(body.note || '').trim() }), reviewedAt);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return send(response, 200, { request: parseActivityRequest(getActivityRequestById.get(existing.id)) });
  }

  if (request.method === 'PUT' && url.pathname === '/api/admin/attendance-policy') {
    if (!requireRole(user, ['admin'])) return send(response, 403, { error: 'Administrator access required.' });
    const body = await readJson(request);
    const requiredFraction = Number(body.requiredFraction);
    if (!Number.isFinite(requiredFraction) || requiredFraction < 0.5 || requiredFraction > 1) {
      return send(response, 400, { error: 'Required attendance must be between 50% and 100%.' });
    }
    const updatedAt = new Date().toISOString();
    database.prepare(`INSERT INTO academic_settings (key, value) VALUES ('required_attendance_fraction', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(String(requiredFraction));
    insertAudit.run(randomBytes(16).toString('hex'), user.id, 'Attendance threshold updated', null, JSON.stringify({ requiredFraction }), updatedAt);
    return send(response, 200, { requiredFraction });
  }

  if (request.method === 'GET' && url.pathname === '/api/schedule') {
    return send(response, 200, { items: database.prepare('SELECT * FROM schedule_items ORDER BY date, time').all() });
  }

  if (request.method === 'POST' && url.pathname === '/api/schedule') {
    if (!requireRole(user, ['admin'])) return send(response, 403, { error: 'Administrator access required.' });
    const body = await readJson(request);
    const date = String(body.date || '');
    const time = String(body.time || '');
    const endTime = String(body.endTime || '');
    const type = String(body.type || '');
    const subject = String(body.subject || '').trim();
    const section = String(body.section || '').trim();
    const faculty = String(body.faculty || '').trim();
    const room = String(body.room || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
      || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) || endTime <= time
      || !['Class', 'Exam', 'Activity'].includes(type) || !subject || !section || !faculty || !room) {
      return send(response, 400, { error: 'Provide a valid date, start and end time, duty type, responsibility, section, faculty, and location.' });
    }
    if (!database.prepare("SELECT 1 FROM users WHERE role = 'teacher' AND name = ? COLLATE NOCASE").get(faculty)) {
      return send(response, 400, { error: 'Assign this duty to a faculty account in the directory.' });
    }
    const id = randomBytes(16).toString('hex');
    const createdAt = new Date().toISOString();
    database.prepare('INSERT INTO schedule_items (id, date, time, end_time, type, subject, section, faculty, room) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, date, time, endTime, type, subject, section, faculty, room);
    insertAudit.run(randomBytes(16).toString('hex'), user.id, 'Academic duty scheduled', id, JSON.stringify({ date, time, endTime, type, subject, section, faculty, room }), createdAt);
    return send(response, 201, { item: { id, date, time, end_time: endTime, type, subject, section, faculty, room } });
  }

  const scheduleDeleteMatch = url.pathname.match(/^\/api\/schedule\/([a-f0-9-]+)$/);
  if (request.method === 'DELETE' && scheduleDeleteMatch) {
    if (!requireRole(user, ['admin'])) return send(response, 403, { error: 'Administrator access required.' });
    const item = database.prepare('SELECT * FROM schedule_items WHERE id = ?').get(scheduleDeleteMatch[1]);
    if (!item) return send(response, 404, { error: 'Schedule item not found.' });
    const pendingDuty = database.prepare("SELECT duties_json FROM availability_requests WHERE status = 'Pending'").all()
      .some((requestRow) => JSON.parse(requestRow.duties_json).some((duty) => duty.id === item.id));
    if (pendingDuty) return send(response, 409, { error: 'Resolve the pending availability request before removing this duty.' });
    const deletedAt = new Date().toISOString();
    database.prepare('DELETE FROM schedule_items WHERE id = ?').run(item.id);
    insertAudit.run(randomBytes(16).toString('hex'), user.id, 'Academic duty removed', item.id, JSON.stringify(item), deletedAt);
    return send(response, 200, { ok: true });
  }

  if (request.method === 'GET' && url.pathname === '/api/availability') {
    const rows = user.role === 'admin'
      ? availabilitySelect.all()
      : getAvailabilityForTeacher.all(user.id);
    return send(response, 200, { requests: rows.map(parseRequest) });
  }

  if (request.method === 'POST' && url.pathname === '/api/availability') {
    if (!requireRole(user, ['teacher'])) return send(response, 403, { error: 'Only faculty can submit availability requests.' });
    const body = await readJson(request);
    const startDate = String(body.startDate || '');
    const endDate = String(body.endDate || '');
    const reason = String(body.reason || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < startDate || !reason || reason.length > 500) {
      return send(response, 400, { error: 'Enter a valid date range and a reason (maximum 500 characters).' });
    }
    const duties = selectSchedule.all(startDate, endDate).filter((item) => item.faculty.toLowerCase() === user.name.toLowerCase());
    const id = randomBytes(16).toString('hex');
    const createdAt = new Date().toISOString();
    database.prepare(`INSERT INTO availability_requests (id, user_id, start_date, end_date, reason, duties_json, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?)`).run(id, user.id, startDate, endDate, reason, JSON.stringify(duties), createdAt);
    insertAudit.run(randomBytes(16).toString('hex'), user.id, 'Faculty availability submitted', id, JSON.stringify({ startDate, endDate, dutyCount: duties.length }), createdAt);
    return send(response, 201, { request: parseRequest({ id, user_id: user.id, name: user.name, start_date: startDate, end_date: endDate, reason, duties_json: JSON.stringify(duties), status: 'Pending', coverage_plan: null, reviewed_by: null, created_at: createdAt, reviewed_at: null }) });
  }

  const reviewMatch = url.pathname.match(/^\/api\/availability\/([a-f0-9]+)\/review$/);
  if (request.method === 'POST' && reviewMatch) {
    if (!requireRole(user, ['admin'])) return send(response, 403, { error: 'Only administrators can review availability requests.' });
    const body = await readJson(request);
    const status = String(body.status || '');
    if (!['Approved', 'Declined'].includes(status)) return send(response, 400, { error: 'Choose approve or decline.' });
    const existing = getAvailabilityById.get(reviewMatch[1]);
    if (!existing) return send(response, 404, { error: 'Availability request not found.' });
    if (existing.status !== 'Pending') return send(response, 409, { error: 'This request has already been reviewed.' });
    const duties = JSON.parse(existing.duties_json);
    const coveragePlans = body.coveragePlans && typeof body.coveragePlans === 'object' ? body.coveragePlans : {};
    if (status === 'Approved' && duties.some((duty) => !String(coveragePlans[duty.id] || '').trim())) {
      return send(response, 400, { error: 'Add coverage for every affected class, exam, and activity before approving.' });
    }
    const reviewedAt = new Date().toISOString();
    const coveragePlan = status === 'Approved' ? JSON.stringify(coveragePlans) : null;
    database.exec('BEGIN IMMEDIATE');
    try {
      database.prepare(`UPDATE availability_requests SET status = ?, coverage_plan = ?, reviewed_by = ?, reviewed_at = ?
        WHERE id = ? AND status = 'Pending'`).run(status, coveragePlan, user.id, reviewedAt, existing.id);
      insertAudit.run(randomBytes(16).toString('hex'), user.id, `Availability request ${status.toLowerCase()}`, existing.id, JSON.stringify({ dutyCount: duties.length, coveragePlans }), reviewedAt);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    const refreshed = getAvailabilityById.get(existing.id);
    const owner = database.prepare('SELECT name FROM users WHERE id = ?').get(existing.user_id);
    return send(response, 200, { request: parseRequest({ ...refreshed, name: owner.name }) });
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/users') {
    if (!requireRole(user, ['admin'])) return send(response, 403, { error: 'Administrator access required.' });
    const users = database.prepare('SELECT id, name, email, enrollment, role, department, section, created_at FROM users ORDER BY role, name').all();
    return send(response, 200, { users });
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/users') {
    if (!requireRole(user, ['admin'])) return send(response, 403, { error: 'Administrator access required.' });
    const body = await readJson(request);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const enrollment = String(body.enrollment || '').trim() || null;
    const role = String(body.role || '');
    const password = String(body.password || '');
    const department = String(body.department || '').trim() || null;
    const section = String(body.section || '').trim() || null;
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || !['student', 'teacher', 'admin'].includes(role) || password.length < 12 || (role === 'student' && !enrollment)) {
      return send(response, 400, { error: 'Enter a name, valid email, role, 12-character password, and enrollment ID for students.' });
    }
    const duplicate = database.prepare('SELECT 1 FROM users WHERE email = ? COLLATE NOCASE OR (? IS NOT NULL AND enrollment = ? COLLATE NOCASE)').get(email, enrollment, enrollment);
    if (duplicate) return send(response, 409, { error: 'That email or enrollment ID is already registered.' });
    const id = randomBytes(16).toString('hex');
    const createdAt = new Date().toISOString();
    database.prepare('INSERT INTO users (id, name, email, enrollment, role, password_hash, department, section, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, name, email, enrollment, role, hashPassword(password), department, section, createdAt);
    insertAudit.run(randomBytes(16).toString('hex'), user.id, 'Account created', id, JSON.stringify({ name, email, role }), createdAt);
    return send(response, 201, { user: { id, name, email, enrollment, role, department, section, created_at: createdAt } });
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/audit') {
    if (!requireRole(user, ['admin'])) return send(response, 403, { error: 'Administrator access required.' });
    const events = database.prepare(`SELECT audit_events.*, users.name AS actor FROM audit_events
      JOIN users ON users.id = audit_events.actor_id ORDER BY audit_events.created_at DESC LIMIT 100`).all();
    return send(response, 200, { events });
  }

  return send(response, 404, { error: 'API route not found.' });
}

function serveStatic(request, response, url) {
  const dist = join(root, 'dist');
  if (!existsSync(join(dist, 'index.html'))) return send(response, 404, { error: 'Build the web app before starting production mode.' });
  let requestedPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  requestedPath = normalize(requestedPath).replace(/^([.][.][/\\])+/, '');
  let file = join(dist, requestedPath);
  if (!file.startsWith(dist) || !existsSync(file) || !statSync(file).isFile()) file = join(dist, 'index.html');
  response.writeHead(200, { 'Content-Type': mimeTypes[extname(file)] || 'application/octet-stream' });
  response.end(readFileSync(file));
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) {
    try {
      await handleApi(request, response, url);
    } catch (error) {
      console.error(error);
      if (!response.headersSent) send(response, 400, { error: 'The request could not be completed.' });
      else response.destroy();
    }
    return;
  }
  if (process.env.NODE_ENV === 'production' && request.method === 'GET') return serveStatic(request, response, url);
  send(response, 404, { error: 'Not found.' });
});

server.listen(port, '127.0.0.1', () => console.log(`AIRS API listening on http://127.0.0.1:${port}`));
