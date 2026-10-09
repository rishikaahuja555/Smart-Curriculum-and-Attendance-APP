CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id),
  teacher_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  term TEXT NOT NULL,
  planned_sessions INTEGER NOT NULL DEFAULT 16 CHECK (planned_sessions > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, name, academic_year, term)
);

CREATE TABLE IF NOT EXISTS enrollments (
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (student_id, section_id)
);

CREATE TABLE IF NOT EXISTS syllabus_units (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, title)
);

CREATE TABLE IF NOT EXISTS syllabus_topics (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  unit_id TEXT REFERENCES syllabus_units(id),
  unit_name TEXT NOT NULL,
  title TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, unit_name, title)
);

CREATE TABLE IF NOT EXISTS section_topic_progress (
  section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES syllabus_topics(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('Covered', 'Uncovered')),
  updated_by TEXT REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (section_id, topic_id)
);

CREATE TABLE IF NOT EXISTS recovery_resources (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES syllabus_topics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('Notes', 'Practice', 'Video', 'Reading')),
  url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (topic_id, title)
);

CREATE TABLE IF NOT EXISTS attendance_sessions (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL REFERENCES sections(id),
  teacher_id TEXT NOT NULL REFERENCES users(id),
  session_date TEXT NOT NULL,
  topic_id TEXT REFERENCES syllabus_topics(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (section_id, session_date)
);

CREATE TABLE IF NOT EXISTS attendance_records (
  session_id TEXT NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('Present', 'Late', 'Absent')),
  marked_by TEXT NOT NULL REFERENCES users(id),
  marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, student_id, topic_id),
  FOREIGN KEY (session_id, student_id) REFERENCES attendance_records(session_id, student_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recovery_progress (
  missed_topic_id TEXT PRIMARY KEY REFERENCES missed_topics(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('Not started', 'In progress', 'Completed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS academic_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS activity_request_reviews (
  request_id TEXT NOT NULL REFERENCES activity_requests(id) ON DELETE CASCADE,
  reviewer_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Approved', 'Declined')),
  decision_note TEXT,
  reviewed_at TIMESTAMPTZ,
  PRIMARY KEY (request_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_sections_teacher_name ON sections(teacher_id, name);
CREATE INDEX IF NOT EXISTS idx_enrollments_section_student ON enrollments(section_id, student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student_session ON attendance_records(student_id, session_id);
CREATE INDEX IF NOT EXISTS idx_activity_requests_status_date ON activity_requests(status, activity_date, start_time);
CREATE INDEX IF NOT EXISTS idx_activity_request_reviews_reviewer_status ON activity_request_reviews(reviewer_id, status);
CREATE INDEX IF NOT EXISTS idx_syllabus_units_course_position ON syllabus_units(course_id, position);
CREATE INDEX IF NOT EXISTS idx_section_topic_progress_status ON section_topic_progress(section_id, status);
CREATE INDEX IF NOT EXISTS idx_recovery_resources_topic ON recovery_resources(topic_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_topics_unit_position ON syllabus_topics(unit_id, position);
