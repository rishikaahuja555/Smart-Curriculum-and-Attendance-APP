const CLASS_DATES = [
  '2026-08-21', '2026-08-24', '2026-08-28', '2026-08-31', '2026-09-04', '2026-09-07',
  '2026-09-11', '2026-09-14', '2026-09-18', '2026-09-21', '2026-09-25', '2026-09-28', '2026-10-02'
];

const FACULTY = [
  { key: 'meera', name: 'Dr. Meera Iyer', email: 'meera.iyer@demo.airs.local', department: 'Computer Science' },
  { key: 'karan', name: 'Prof. Karan Sud', email: 'karan.sud@demo.airs.local', department: 'Computer Science' },
  { key: 'nandini', name: 'Dr. Nandini', email: 'nandini@demo.airs.local', department: 'Electronics' },
  { key: 'arun', name: 'Prof. Arun', email: 'arun@demo.airs.local', department: 'Computer Science' }
];

const COURSES = [
  { key: 'dbms', code: 'AIRS-DEMO-DBMS', name: 'Database Management Systems', department: 'Computer Science', units: [
    ['Database foundations', ['ER modeling', 'Relational model']], ['Relational design', ['Functional dependencies', 'Normalization']], ['Query processing', ['SQL joins', 'Indexing']]
  ] },
  { key: 'os', code: 'AIRS-DEMO-OS', name: 'Operating Systems', department: 'Computer Science', units: [
    ['Processes', ['Process scheduling', 'Threads']], ['Concurrency', ['Synchronization', 'Deadlocks']], ['Memory', ['Paging', 'Virtual memory']]
  ] },
  { key: 'networks', code: 'AIRS-DEMO-CN', name: 'Computer Networks', department: 'Computer Science', units: [
    ['Network foundations', ['Layered models', 'Ethernet']], ['Routing', ['IP addressing', 'Routing protocols']], ['Transport', ['TCP', 'Congestion control']]
  ] },
  { key: 'signals', code: 'AIRS-DEMO-ECE', name: 'Signals and Systems', department: 'Electronics', units: [
    ['Signal basics', ['Continuous signals', 'Discrete signals']], ['Transforms', ['Fourier transform', 'Laplace transform']], ['Systems', ['Convolution', 'Sampling']]
  ] },
  { key: 'algorithms', code: 'AIRS-DEMO-ALG', name: 'Algorithms', department: 'Computer Science', units: [
    ['Foundations', ['Asymptotic analysis', 'Recurrences']], ['Graph algorithms', ['Graph search', 'Shortest paths']], ['Optimization', ['Greedy algorithms', 'Dynamic programming']]
  ] },
  { key: 'quantum', code: 'AIRS-DEMO-QC', name: 'Quantum Computing', department: 'Computer Science', units: [
    ['Quantum foundations', ['Qubits and superposition', 'Measurement and observables']], ['Quantum circuits', ['Quantum gates', 'Circuit design']], ['Quantum algorithms', ['Grover search', 'Shor algorithm']]
  ] },
  { key: 'prompt-engineering', code: 'AIRS-DEMO-PE', name: 'Prompt Engineering', department: 'Computer Science', units: [
    ['Prompt foundations', ['Prompt structure', 'Context and constraints']], ['Advanced prompting', ['Few-shot prompting', 'Tool-using prompts']], ['Evaluation', ['Prompt testing', 'Responsible prompting']]
  ] },
  { key: 'deep-learning', code: 'AIRS-DEMO-DL', name: 'Deep Learning', department: 'Computer Science', units: [
    ['Neural networks', ['Network foundations', 'Backpropagation']], ['Deep architectures', ['Convolutional networks', 'Transformers']], ['Training and deployment', ['Optimization methods', 'Model deployment']]
  ] },
  { key: 'cloud-computing', code: 'AIRS-DEMO-CLOUD', name: 'Cloud Computing', department: 'Computer Science', units: [
    ['Cloud foundations', ['Cloud service models', 'Virtualization']], ['Cloud platforms', ['Containers', 'Serverless computing']], ['Cloud operations', ['Cloud security', 'Observability']]
  ] },
  { key: 'data-science', code: 'AIRS-DEMO-DS', name: 'Introduction to Data Science', department: 'Computer Science', units: [
    ['Data science workflow', ['Data collection', 'Data cleaning']], ['Exploration and analysis', ['Exploratory analysis', 'Descriptive statistics']], ['Modeling and communication', ['Introduction to machine learning', 'Data visualization']]
  ] },
  { key: 'compiler-design', code: 'AIRS-DEMO-CD', name: 'Compiler Design', department: 'Computer Science', units: [
    ['Language processing', ['Lexical analysis', 'Parsing']], ['Semantic analysis', ['Type checking', 'Symbol tables']], ['Code generation', ['Intermediate representation', 'Code optimization']]
  ] }
];

const SECTIONS = [
  { key: 'dbms-cse-3b', name: 'CSE-3B', course: 'dbms', faculty: 'meera', time: '09:00', room: 'LT-204' },
  { key: 'dbms-cse-6a', name: 'CSE-6A', course: 'dbms', faculty: 'meera', time: '10:30', room: 'LT-206' },
  { key: 'os-cse-6b', name: 'CSE-6B', course: 'os', faculty: 'karan', time: '12:00', room: 'LAB-1' },
  { key: 'networks-cse-5a', name: 'CSE-5A', course: 'networks', faculty: 'arun', time: '14:00', room: 'LC-3' },
  { key: 'signals-ece-4c', name: 'ECE-4C', course: 'signals', faculty: 'nandini', time: '15:30', room: 'E-12' }
];

const EXTRA_SECTIONS = [
  { key: 'quantum-cse-4a', name: 'CSE-4A', course: 'quantum', faculty: 'meera', time: '09:00', room: 'LT-208' },
  { key: 'prompt-cse-4a', name: 'CSE-4A', course: 'prompt-engineering', faculty: 'karan', time: '10:30', room: 'LT-210' },
  { key: 'deep-learning-cse-4b', name: 'CSE-4B', course: 'deep-learning', faculty: 'arun', time: '12:00', room: 'LAB-2' },
  { key: 'cloud-cse-4b', name: 'CSE-4B', course: 'cloud-computing', faculty: 'karan', time: '13:30', room: 'LAB-3' },
  { key: 'data-science-cse-4c', name: 'CSE-4C', course: 'data-science', faculty: 'nandini', time: '14:00', room: 'LT-212' },
  { key: 'compiler-cse-4c', name: 'CSE-4C', course: 'compiler-design', faculty: 'meera', time: '15:30', room: 'LT-214' }
];

const FIRST_NAMES = ['Aarav', 'Ananya', 'Diya', 'Ishaan', 'Kabir', 'Meera', 'Nikhil', 'Priya', 'Rohan', 'Sanya'];
const LAST_NAMES = ['Sharma', 'Rao', 'Nair', 'Kapoor', 'Menon'];
const ACTIVITY_TITLES = ['Research symposium', 'Robotics showcase', 'Student design expo', 'Inter-college hackathon', 'Innovation fair'];
const REVIEW_STATUSES = ['Pending', 'Pending', 'Approved', 'Pending', 'Declined', 'Pending', 'Approved', 'Pending'];
const CHRONIC_ABSENCES_BY_COURSE = {
  dbms: [1, 3, 6, 9, 11],
  os: [1, 6, 10],
  networks: [2, 5, 8, 11],
  signals: [0, 2, 4, 6, 8, 10],
  algorithms: [1, 3, 6, 9, 11],
  quantum: [0, 4, 8],
  'prompt-engineering': [1, 4, 7, 10],
  'deep-learning': [0, 2, 4, 6, 8, 10],
  'cloud-computing': [1, 3, 6, 9, 11],
  'data-science': [0, 4, 8],
  'compiler-design': [1, 4, 7, 10]
};

function timeAfter(time, minutes) {
  const [hour, minute] = time.split(':').map(Number);
  const total = hour * 60 + minute + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function seedDemoData(database, { password, hashPassword }) {
  if (process.env.NODE_ENV === 'production' || process.env.AIRS_SEED_DEMO !== '1') return;
  if (!password) throw new Error('Set AIRS_DEMO_PASSWORD when AIRS_SEED_DEMO=1.');

  const passwordHash = hashPassword(password);
  database.exec('BEGIN IMMEDIATE');
  try {
    const rebalanceDemoAttendance = !database.prepare("SELECT 1 FROM academic_settings WHERE key = 'demo_attendance_variation_v1'").get();
    const insertDemoAudit = database.prepare(`INSERT OR IGNORE INTO audit_events
      (id, actor_id, action, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)`);
    const insertUser = database.prepare(`INSERT OR IGNORE INTO users
      (id, name, email, enrollment, role, password_hash, department, section)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    insertUser.run('airs-demo-admin', 'Alicia Reed', 'admin@demo.airs.local', null, 'admin', passwordHash, 'Administration', null);

    const facultyIds = new Map();
    for (const faculty of FACULTY) {
      const existing = database.prepare("SELECT id FROM users WHERE role = 'teacher' AND name = ? COLLATE NOCASE LIMIT 1").get(faculty.name);
      const id = existing?.id || `airs-demo-teacher-${faculty.key}`;
      if (!existing) insertUser.run(id, faculty.name, faculty.email, null, 'teacher', passwordHash, faculty.department, null);
      facultyIds.set(faculty.key, id);
    }

    const insertCourse = database.prepare('INSERT OR IGNORE INTO courses (id, code, name, department) VALUES (?, ?, ?, ?)');
    const insertUnit = database.prepare('INSERT OR IGNORE INTO syllabus_units (id, course_id, title, position) VALUES (?, ?, ?, ?)');
    const insertTopic = database.prepare(`INSERT OR IGNORE INTO syllabus_topics
      (id, course_id, unit_id, unit_name, title, position) VALUES (?, ?, ?, ?, ?, ?)`);
    const topicsByCourse = new Map();
    for (const course of COURSES) {
      const courseId = `airs-demo-course-${course.key}`;
      insertCourse.run(courseId, course.code, course.name, course.department);
      const topics = [];
      let topicPosition = 0;
      for (const [unitIndex, [unitTitle, topicTitles]] of course.units.entries()) {
        const unitId = `airs-demo-unit-${course.key}-${unitIndex + 1}`;
        insertUnit.run(unitId, courseId, unitTitle, unitIndex + 1);
        for (const topicTitle of topicTitles) {
          topicPosition += 1;
          const topic = { id: `airs-demo-topic-${course.key}-${String(topicPosition).padStart(2, '0')}`, unitId, unitTitle, title: topicTitle, position: topicPosition };
          insertTopic.run(topic.id, courseId, unitId, unitTitle, topicTitle, topicPosition);
          topics.push(topic);
        }
      }
      topicsByCourse.set(course.key, { id: courseId, topics });
    }

    const sectionIds = new Map();
    const insertSection = database.prepare(`INSERT OR IGNORE INTO sections
      (id, course_id, teacher_id, name, academic_year, term, planned_sessions)
      VALUES (?, ?, ?, ?, '2026-2027', 'Fall', 20)`);
    const demoSections = [...SECTIONS, ...EXTRA_SECTIONS];
    for (const section of demoSections) {
      const id = `airs-demo-section-${section.key}`;
      sectionIds.set(section.key, id);
      insertSection.run(id, topicsByCourse.get(section.course).id, facultyIds.get(section.faculty), section.name);
    }

    const studentsBySection = new Map(demoSections.map((section) => [section.key, []]));
    const demoStudents = [];
    const insertStudent = database.prepare(`INSERT OR IGNORE INTO users
      (id, name, email, enrollment, role, password_hash, department, section)
      VALUES (?, ?, ?, ?, 'student', ?, ?, ?)`);
    const insertEnrollment = database.prepare('INSERT OR IGNORE INTO enrollments (student_id, section_id) VALUES (?, ?)');
    for (let index = 0; index < 50; index += 1) {
      const section = SECTIONS[index % SECTIONS.length];
      const number = String(index + 1).padStart(4, '0');
      const name = index === 0 ? 'Rishika Ahuja' : `${FIRST_NAMES[index % FIRST_NAMES.length]} ${LAST_NAMES[Math.floor(index / FIRST_NAMES.length)]}`;
      const studentId = `airs-demo-student-${number}`;
      insertStudent.run(studentId, name, `student${number}@demo.airs.local`, `DEMO-${number}`, passwordHash,
        COURSES.find((course) => course.key === section.course).department, section.name);
      if (index === 0) {
        database.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, studentId);
        database.prepare('UPDATE sessions SET display_name = ? WHERE user_id = ?').run(name, studentId);
      }
      insertEnrollment.run(studentId, sectionIds.get(section.key));
      const student = { id: studentId, number, ordinal: Math.floor(index / SECTIONS.length) };
      studentsBySection.get(section.key).push(student);
      demoStudents.push(student);
    }

    for (const section of EXTRA_SECTIONS) {
      for (const student of demoStudents) {
        insertEnrollment.run(student.id, sectionIds.get(section.key));
        studentsBySection.get(section.key).push(student);
      }
    }

    const insertTopicProgress = database.prepare(`INSERT OR IGNORE INTO section_topic_progress
      (section_id, topic_id, status, updated_by, updated_at) VALUES (?, ?, ?, ?, '2026-10-02T08:00:00.000Z')`);
    const insertSchedule = database.prepare(`INSERT OR IGNORE INTO schedule_items
      (id, date, time, end_time, type, subject, section, faculty, room) VALUES (?, ?, ?, ?, 'Class', ?, ?, ?, ?)`);
    const insertSession = database.prepare(`INSERT OR IGNORE INTO attendance_sessions
      (id, section_id, teacher_id, session_date, topic_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`);
    const insertSessionTopic = database.prepare('INSERT OR IGNORE INTO session_topics (session_id, topic_id) VALUES (?, ?)');
    const insertAttendance = database.prepare(rebalanceDemoAttendance
      ? `INSERT INTO attendance_records (session_id, student_id, status, marked_by, marked_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(session_id, student_id) DO UPDATE SET status = excluded.status, marked_by = excluded.marked_by, marked_at = excluded.marked_at`
      : `INSERT OR IGNORE INTO attendance_records (session_id, student_id, status, marked_by, marked_at) VALUES (?, ?, ?, ?, ?)`);
    const insertMissed = database.prepare(`INSERT OR IGNORE INTO missed_topics
      (id, session_id, student_id, topic_id, created_at) VALUES (?, ?, ?, ?, ?)`);
    const insertRecovery = database.prepare(`INSERT OR IGNORE INTO recovery_progress
      (missed_topic_id, status, started_at, completed_at) VALUES (?, ?, ?, ?)`);
    const insertResource = database.prepare(`INSERT OR IGNORE INTO recovery_resources
      (id, topic_id, title, resource_type, url) VALUES (?, ?, ?, ?, NULL)`);
    database.prepare(`INSERT OR IGNORE INTO academic_settings (key, value) VALUES ('required_attendance_fraction', '0.75')`).run();

    const sectionSchedules = new Map();
    if (rebalanceDemoAttendance) {
      database.prepare("DELETE FROM missed_topics WHERE session_id LIKE 'airs-demo-session-%'").run();
    }
    for (const section of demoSections) {
      const sectionId = sectionIds.get(section.key);
      const facultyId = facultyIds.get(section.faculty);
      const faculty = FACULTY.find((item) => item.key === section.faculty);
      const course = COURSES.find((item) => item.key === section.course);
      const courseOffset = COURSES.findIndex((item) => item.key === section.course);
      const topicSet = topicsByCourse.get(section.course).topics;
      for (const [topicIndex, topic] of topicSet.entries()) {
        insertTopicProgress.run(sectionId, topic.id, topicIndex < 4 ? 'Covered' : 'Uncovered', facultyId);
        insertResource.run(`airs-demo-resource-${topic.id}-notes`, topic.id, `${topic.title} lecture notes`, 'Notes');
        insertResource.run(`airs-demo-resource-${topic.id}-practice`, topic.id, `${topic.title} practice set`, 'Practice');
      }

      const scheduleRows = [];
      for (const [sessionIndex, date] of CLASS_DATES.entries()) {
        const sessionId = `airs-demo-session-${section.key}-${date.replaceAll('-', '')}`;
        const markedAt = `${date}T08:00:00.000Z`;
        const topic = topicSet[Math.min(3, Math.floor(sessionIndex / 2))];
        const scheduleId = `airs-demo-schedule-${section.key}-${date.replaceAll('-', '')}`;
        const endTime = timeAfter(section.time, 60);
        scheduleRows.push({ id: scheduleId, date, time: section.time, endTime, subject: course.name, section: section.name, faculty: faculty.name, room: section.room });
        insertSchedule.run(scheduleId, date, section.time, endTime, course.name, section.name, faculty.name, section.room);
        insertSession.run(sessionId, sectionId, facultyId, date, topic.id, markedAt);
        insertSessionTopic.run(sessionId, topic.id);

        for (const student of studentsBySection.get(section.key)) {
          const chronic = student.ordinal === 0;
          const absent = chronic
            ? CHRONIC_ABSENCES_BY_COURSE[course.key].includes(sessionIndex)
            : (sessionIndex === (6 + courseOffset) % CLASS_DATES.length && student.ordinal % 4 !== 0)
              || ((student.ordinal + sessionIndex * 7 + courseOffset * 5) % 23 === 0);
          const status = absent ? 'Absent' : (student.ordinal + sessionIndex + courseOffset) % 9 === 0 ? 'Late' : 'Present';
          insertAttendance.run(sessionId, student.id, status, facultyId, markedAt);
          if (absent) {
            const missedId = `airs-demo-missed-${section.key}-${date.replaceAll('-', '')}-${student.number}-${topic.position}`;
            insertMissed.run(missedId, sessionId, student.id, topic.id, markedAt);
            const recoveryStatus = sessionIndex % 3 === 0 ? 'In progress' : 'Not started';
            insertRecovery.run(missedId, recoveryStatus, recoveryStatus === 'In progress' ? markedAt : null, null);
          }
        }
        insertDemoAudit.run(`airs-demo-audit-attendance-${section.key}-${date.replaceAll('-', '')}`, facultyId,
          'Demo attendance recorded', sessionId, JSON.stringify({ section: section.name, date }), markedAt);
      }
      sectionSchedules.set(section.key, scheduleRows);
    }

    const insertActivity = database.prepare(`INSERT OR IGNORE INTO activity_requests
      (id, student_id, title, activity_date, start_time, end_time, reason, status, conflicts_json, created_at, reviewed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const insertReview = database.prepare(`INSERT OR IGNORE INTO activity_request_reviews
      (request_id, reviewer_id, status, decision_note, reviewed_at) VALUES (?, ?, ?, ?, ?)`);
    for (let index = 0; index < 10; index += 1) {
      const section = SECTIONS[index % SECTIONS.length];
      const student = studentsBySection.get(section.key)[index % 10];
      const todaySchedule = sectionSchedules.get(section.key).find((item) => item.date === '2026-10-02');
      const conflict = index < 8;
      const requestId = `airs-demo-activity-${String(index + 1).padStart(4, '0')}`;
      const status = conflict ? REVIEW_STATUSES[index] : 'Approved';
      const startTime = conflict ? todaySchedule.time : '18:00';
      const endTime = conflict ? timeAfter(todaySchedule.time, 45) : '19:00';
      const createdAt = `2026-09-${String(10 + index).padStart(2, '0')}T09:00:00.000Z`;
      const reviewedAt = status === 'Pending' ? null : '2026-10-01T12:00:00.000Z';
      const conflicts = conflict ? [{ type: 'class', scheduleId: todaySchedule.id, subject: todaySchedule.subject,
        section: todaySchedule.section, faculty: todaySchedule.faculty, startTime: todaySchedule.time, endTime: todaySchedule.endTime }] : [];
      insertActivity.run(requestId, student.id, ACTIVITY_TITLES[index % ACTIVITY_TITLES.length], '2026-10-02', startTime, endTime,
        'Participating in a scheduled academic activity.', status, JSON.stringify(conflicts), createdAt, reviewedAt);
      if (conflict) insertReview.run(requestId, facultyIds.get(section.faculty), status,
        status === 'Pending' ? null : 'Demo faculty review.', reviewedAt);
    }

    for (const faculty of FACULTY.slice(1)) {
      const facultyId = facultyIds.get(faculty.key);
      const duties = database.prepare(`SELECT * FROM schedule_items WHERE id LIKE 'airs-demo-schedule-%'
        AND faculty = ? AND date = '2026-10-02' ORDER BY time`).all(faculty.name);
      if (!duties.length) continue;
      const availabilityId = `airs-demo-availability-${faculty.key}`;
      database.prepare(`INSERT OR IGNORE INTO availability_requests
        (id, user_id, start_date, end_date, reason, duties_json, status, created_at)
        VALUES (?, ?, '2026-10-02', '2026-10-02', 'Demo faculty availability review.', ?, 'Pending', '2026-09-29T09:00:00.000Z')`)
        .run(availabilityId, facultyId, JSON.stringify(duties));
      insertDemoAudit.run(`airs-demo-audit-availability-${faculty.key}`, facultyId, 'Demo availability request submitted', availabilityId,
        JSON.stringify({ dutyCount: duties.length }), '2026-09-29T09:00:00.000Z');
    }

    const adminId = database.prepare("SELECT id FROM users WHERE role = 'admin' AND email = 'admin@demo.airs.local'").get()?.id || 'airs-demo-admin';
    insertDemoAudit.run('airs-demo-audit-admin-001', adminId, 'Demo data initialized', null,
      JSON.stringify({ students: 50, sessionsPerSection: CLASS_DATES.length, activityRequests: 10 }), '2026-10-02T08:00:00.000Z');
    database.prepare("INSERT OR IGNORE INTO academic_settings (key, value) VALUES ('demo_attendance_variation_v1', '1')").run();
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}